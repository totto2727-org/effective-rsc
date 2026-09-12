// Adapted from the rsc-html-stream test suite by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.
import { createContext, runInContext } from "node:vm";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  type EmbeddedFlightChunk,
  makeInitialFlightStream,
} from "../../src/client/initial-flight-stream";
import { injectFlightPayload } from "../../src/server/flight-html-stream";

const Encoder = new TextEncoder();

type SourceChunk = string | Uint8Array | (() => void | Promise<void>);

const streamFrom = (source: ReadonlyArray<SourceChunk>) => {
  const chunks = [...source];
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const drain = (): void | Promise<void> => {
        while (chunks.length > 0) {
          const chunk = chunks.shift();
          if (typeof chunk === "function") {
            return Promise.resolve(chunk()).then(drain);
          }
          if (typeof chunk === "string") {
            controller.enqueue(Encoder.encode(chunk));
          } else if (chunk !== undefined) {
            controller.enqueue(chunk);
          }
        }
        controller.close();
      };
      return drain();
    },
  });
};

const streamToBytes = (stream: ReadableStream<Uint8Array>) =>
  Effect.promise(async () => new Uint8Array(await new Response(stream).arrayBuffer()));

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const streamToText = (stream: ReadableStream<Uint8Array>) =>
  streamToBytes(stream).pipe(Effect.map((bytes) => new TextDecoder().decode(bytes)));

const embeddedFlightQueue = (html: string, nonce?: string) => {
  const nonceAttribute = nonce === undefined ? "" : ` nonce="${nonce}"`;
  const scripts = html.matchAll(new RegExp(`<script${nonceAttribute}>(.*?)<\\/script>`, "g"));
  const self: { __FLIGHT_DATA?: Array<EmbeddedFlightChunk> } = {};
  const context = createContext({ atob, self, Uint8Array });
  for (const script of scripts) {
    runInContext(script[1] ?? "", context);
  }
  return self.__FLIGHT_DATA ?? [];
};

const reconstructFlight = (html: string, nonce?: string) =>
  streamToBytes(makeInitialFlightStream(embeddedFlightQueue(html, nonce), (close) => close()));

const flightScript = (text: string) =>
  `<script>(self.__FLIGHT_DATA||=[]).push(${JSON.stringify(text)})</script>`;

describe("injectFlightPayload", () => {
  it.effect("embeds text chunks and reconstructs the original Flight bytes", () =>
    Effect.gen(function* () {
      const html = streamFrom(["<html><body><h1>Test</h1>", "<p>Hello world</p></body></html>"]);
      const flight = streamFrom(["foo bar", "baz qux", "abcdef"]);

      const result = yield* streamToText(html.pipeThrough(injectFlightPayload(flight)));

      expect(result).toBe(
        "<html><body><h1>Test</h1><p>Hello world</p>" +
          ["foo bar", "baz qux", "abcdef"].map(flightScript).join("") +
          "</body></html>",
      );
      const reconstructed = yield* reconstructFlight(result);
      expect(new TextDecoder().decode(reconstructed)).toBe("foo barbaz quxabcdef");
    }),
  );

  it.effect("uses base64 for invalid UTF-8 and reconstructs the original bytes", () =>
    Effect.gen(function* () {
      const binary = new Uint8Array([1, 2, 3, 4, 5, 0xe2, 0x28, 0xa1]);
      const html = streamFrom(["<html><body><h1>Test</h1></body></html>"]);
      const flight = streamFrom(["foo bar", binary]);

      const result = yield* streamToText(html.pipeThrough(injectFlightPayload(flight)));

      expect(result).toContain(
        "<script>(self.__FLIGHT_DATA||=[]).push(" +
          'Uint8Array.from(atob("AQIDBAXiKKE="),character=>character.codePointAt(0)))</script>',
      );
      const reconstructed = yield* reconstructFlight(result);
      expect(reconstructed).toEqual(new Uint8Array([...Encoder.encode("foo bar"), ...binary]));
    }),
  );

  it.effect("defers scheduled Flight scripts until all HTML has been forwarded", () =>
    Effect.gen(function* () {
      const continueFlight = Promise.withResolvers<void>();
      const html = streamFrom([
        "<html><body><h1>Test</h1>",
        () => sleep(3),
        "<p>Hello",
        () => continueFlight.resolve(),
        " world</p></body></html>",
      ]);
      const flight = streamFrom(["foo bar", () => continueFlight.promise, "baz qux", "abcdef"]);

      const result = yield* streamToText(html.pipeThrough(injectFlightPayload(flight)));

      expect(result).toBe(
        "<html><body><h1>Test</h1><p>Hello world</p>" +
          ["foo bar", "baz qux", "abcdef"].map(flightScript).join("") +
          "</body></html>",
      );
      expect(result.indexOf('push("foo bar")')).toBeLessThan(result.indexOf('push("baz qux")'));
      expect(result.indexOf('push("baz qux")')).toBeLessThan(result.indexOf('push("abcdef")'));
    }),
  );

  it.effect("adds a nonce to each embedded script", () =>
    Effect.gen(function* () {
      const html = streamFrom(["<html><body>Test</body></html>"]);
      const flight = streamFrom(["foo bar"]);

      const result = yield* streamToText(
        html.pipeThrough(injectFlightPayload(flight, { nonce: "test" })),
      );

      expect(result).toBe(
        '<html><body>Test<script nonce="test">' +
          '(self.__FLIGHT_DATA||=[]).push("foo bar")</script></body></html>',
      );
      const reconstructed = yield* reconstructFlight(result, "test");
      expect(new TextDecoder().decode(reconstructed)).toBe("foo bar");
    }),
  );

  it.effect("does not split a multi-byte HTML character or a chunked closing trailer", () =>
    Effect.gen(function* () {
      const html = streamFrom([
        "<html><body><h1>Test</h1>",
        new Uint8Array([240]),
        new Uint8Array([159]),
        () => Promise.resolve(),
        new Uint8Array([153, 130]),
        "<p>Hello world</p></bo",
        "dy></html>",
      ]);
      const flight = streamFrom(["foo bar"]);

      const result = yield* streamToText(html.pipeThrough(injectFlightPayload(flight)));

      expect(result).toBe(
        "<html><body><h1>Test</h1>🙂<p>Hello world</p>" +
          flightScript("foo bar") +
          "</body></html>",
      );
    }),
  );

  for (const { name, prefix, suffix } of [
    { name: "double-quoted href", prefix: '<a href="/guide/', suffix: '日本語">日本語</a>' },
    { name: "single-quoted attribute", prefix: "<a title='日本", suffix: "語'>link</a>" },
    { name: "unquoted attribute", prefix: "<a href=/gui", suffix: "de>link</a>" },
    { name: "tag name", prefix: "<arti", suffix: "cle>日本語</article>" },
    { name: "comment", prefix: "<!-- sidebar ", suffix: "navigation --><p>日本語</p>" },
    {
      name: "script rawtext",
      prefix: '<script>self.example = "',
      suffix: '</body></html>";</script><p>日本語</p>',
    },
    {
      name: "style rawtext",
      prefix: '<style>.sidebar::after { content: "',
      suffix: '日本語"; }</style><p>日本語</p>',
    },
    { name: "textarea rawtext", prefix: "<textarea>日本", suffix: "語</textarea>" },
    { name: "character reference", prefix: "<p>&am", suffix: "p;日本語</p>" },
  ]) {
    it.effect(`never inserts scheduled Flight inside a split ${name}`, () =>
      Effect.gen(function* () {
        const boundary = Promise.withResolvers<void>();
        const html = streamFrom([
          `<html><body>${prefix}`,
          () => {
            boundary.resolve();
            return sleep(0);
          },
          `${suffix}</bo`,
          () => sleep(0),
          "dy></html>",
        ]);
        const flight = streamFrom([
          () => boundary.promise,
          "scheduled Flight",
          () => sleep(0),
          "later Flight",
        ]);

        const result = yield* streamToText(html.pipeThrough(injectFlightPayload(flight)));

        // Compare the complete output, not output with scripts stripped: stripping
        // would hide scripts injected into attributes, comments or rawtext.
        expect(result).toBe(
          `<html><body>${prefix}${suffix}` +
            flightScript("scheduled Flight") +
            flightScript("later Flight") +
            "</body></html>",
        );
      }),
    );
  }

  it.effect("preserves every HTML byte with scheduled Flight between UTF-8 byte chunks", () =>
    Effect.gen(function* () {
      const body = '<html><body><a href="/日本語">日本語🙂</a>';
      const chunks: SourceChunk[] = [];
      for (const byte of Encoder.encode(`${body}</body></html>`)) {
        chunks.push(new Uint8Array([byte]), () => sleep(0));
      }
      const flight = streamFrom([() => sleep(3), "scheduled Flight"]);
      const result = yield* streamToBytes(
        streamFrom(chunks).pipeThrough(injectFlightPayload(flight)),
      );

      expect(result).toEqual(
        Encoder.encode(`${body}${flightScript("scheduled Flight")}</body></html>`),
      );
    }),
  );

  it.effect("reconstructs arbitrary Flight bytes at every possible chunk split", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array([
        ...Encoder.encode("ASCII 日本語🙂\uFEFF"),
        ...Array.from({ length: 256 }, (_, index) => index),
        ...Encoder.encode("after binary \uFEFF"),
        0xe2,
      ]);
      for (let split = 0; split <= bytes.byteLength; split += 1) {
        const result = yield* streamToText(
          streamFrom(["<html><body>Test</body></html>"]).pipeThrough(
            injectFlightPayload(streamFrom([bytes.slice(0, split), bytes.slice(split)])),
          ),
        );
        const reconstructed = yield* reconstructFlight(result);
        expect(reconstructed, `Flight byte split ${split}`).toEqual(bytes);
      }
    }),
  );

  it.effect("preserves pending UTF-8 before invalid bytes and incomplete terminal chunks", () =>
    Effect.gen(function* () {
      const chunks = [
        new Uint8Array([0x61, 0xe2]),
        new Uint8Array([0x28, 0xa1]),
        Encoder.encode("\uFEFF日本語"),
        new Uint8Array([0xf0, 0x9f]),
      ];
      const result = yield* streamToText(
        streamFrom(["<html><body>Test</body></html>"]).pipeThrough(
          injectFlightPayload(streamFrom(chunks)),
        ),
      );
      const reconstructed = yield* reconstructFlight(result);
      expect(reconstructed).toEqual(new Uint8Array(chunks.flatMap((chunk) => [...chunk])));
    }),
  );

  it.effect("streams HTML before EOF and waits for final Flight before closing the document", () =>
    Effect.gen(function* () {
      const htmlReady = Promise.withResolvers<void>();
      const flightReady = Promise.withResolvers<void>();
      const flightRead = Promise.withResolvers<void>();
      const html = streamFrom([
        "<html><body><p>streamed shell</p>",
        () => htmlReady.promise,
        "<p>resolved content</p></body></html>",
      ]);
      const flight = streamFrom([
        () => flightReady.promise,
        "late Flight",
        () => flightRead.resolve(),
      ]);
      const reader = html.pipeThrough(injectFlightPayload(flight)).getReader();

      const shell = yield* Effect.promise(() => reader.read());
      expect(shell.value).toEqual(Encoder.encode("<html><body><p>streamed shell</p>"));
      htmlReady.resolve();
      const content = yield* Effect.promise(() => reader.read());
      expect(content.value).toEqual(Encoder.encode("<p>resolved content</p>"));
      let settled = false;
      const payload = reader.read().then((value) => {
        settled = true;
        return value;
      });
      yield* Effect.promise(() => sleep(0));
      expect(settled).toBe(false);
      flightReady.resolve();
      const result = yield* Effect.promise(() => payload);
      expect(result.value).toEqual(Encoder.encode(flightScript("late Flight")));
      yield* Effect.promise(() => flightRead.promise);
      const trailer = yield* Effect.promise(() => reader.read());
      expect(trailer.value).toEqual(Encoder.encode("</body></html>"));
      const end = yield* Effect.promise(() => reader.read());
      expect(end.done).toBe(true);
      expect(flight.locked).toBe(false);
    }),
  );

  it.effect(
    "lets the SSR tee branch finish while browser Flight consumption waits for HTML EOF",
    () =>
      Effect.gen(function* () {
        const [ssrFlight, browserFlight] = streamFrom([
          "first",
          () => sleep(0),
          "second",
          () => sleep(0),
          "third",
        ]).tee();
        const ssrReader = ssrFlight.getReader();
        const html = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Encoder.encode("<html><body>"));
          },
          async pull(controller) {
            const result = await ssrReader.read();
            if (result.done) {
              ssrReader.releaseLock();
              controller.enqueue(Encoder.encode("</body></html>"));
              controller.close();
            } else {
              controller.enqueue(
                Encoder.encode(`<p>${new TextDecoder().decode(result.value)}</p>`),
              );
            }
          },
        });
        const result = yield* streamToText(html.pipeThrough(injectFlightPayload(browserFlight)));
        expect(result).toBe(
          "<html><body><p>first</p><p>second</p><p>third</p>" +
            ["first", "second", "third"].map(flightScript).join("") +
            "</body></html>",
        );
        const reconstructed = yield* reconstructFlight(result);
        expect(reconstructed).toEqual(Encoder.encode("firstsecondthird"));
      }),
  );

  it.effect("propagates a Flight read failure after streamed HTML and releases its reader", () =>
    Effect.gen(function* () {
      const failure = new Error("Flight read failed");
      const flight = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(failure);
        },
      });
      const reader = streamFrom(["<html><body>shell</body></html>"])
        .pipeThrough(injectFlightPayload(flight))
        .getReader();
      const shell = yield* Effect.promise(() => reader.read());
      expect(shell.value).toEqual(Encoder.encode("<html><body>shell"));
      yield* Effect.promise(() => expect(reader.read()).rejects.toBe(failure));
      expect(flight.locked).toBe(false);
    }),
  );

  it.effect("escapes script endings and HTML comments in text chunks", () =>
    Effect.gen(function* () {
      const html = streamFrom(["<html><body>Test</body></html>"]);
      const flight = streamFrom(["<!--</ScRiPt>"]);

      const result = yield* streamToText(html.pipeThrough(injectFlightPayload(flight)));

      expect(result).toContain("<\\!--</\\ScRiPt>");
      const reconstructed = yield* reconstructFlight(result);
      expect(new TextDecoder().decode(reconstructed)).toBe("<!--</ScRiPt>");
    }),
  );

  it.effect("settles a concurrent read and cancellation without hanging", () =>
    Effect.gen(function* () {
      const html = streamFrom(["<html><body><h1>html</h1></body></html>"]);
      const flight = streamFrom(["rsc"]);
      const reader = html.pipeThrough(injectFlightPayload(flight)).getReader();

      const read = reader.read();
      yield* Effect.promise(() => sleep(0));
      const cancel = reader.cancel();
      const results = yield* Effect.promise(() => Promise.allSettled([read, cancel]));

      expect(results[0]?.status).toBe("fulfilled");
      expect(results[1]?.status).toBe("fulfilled");
    }),
  );

  it.effect("cancels pending Flight after HTML EOF before waiting for the transform flush", () =>
    Effect.gen(function* () {
      const cancelled: unknown[] = [];
      const flight = new ReadableStream<Uint8Array>({
        cancel(reason) {
          cancelled.push(reason);
        },
      });
      const reader = streamFrom(["<html><body>shell</body></html>"])
        .pipeThrough(injectFlightPayload(flight))
        .getReader();
      yield* Effect.promise(() => reader.read());
      const pending = reader.read();
      yield* Effect.promise(() => sleep(0));

      yield* Effect.promise(() => reader.cancel("response cancelled"));
      const result = yield* Effect.promise(() => pending);
      expect(result.done).toBe(true);
      expect(cancelled).toEqual(["response cancelled"]);
      expect(flight.locked).toBe(false);
    }),
  );

  it.effect("does not wait for the SSR tee sibling before allowing response-scope release", () =>
    Effect.gen(function* () {
      const cancelled: unknown[] = [];
      const [ssrFlight, browserFlight] = new ReadableStream<Uint8Array>({
        cancel(reason) {
          cancelled.push(reason);
        },
      }).tee();
      const ssrReader = ssrFlight.getReader();
      const ssrPending = ssrReader.read();
      const reader = streamFrom(["<html><body>shell</body></html>"])
        .pipeThrough(injectFlightPayload(browserFlight))
        .getReader();
      yield* Effect.promise(() => reader.read());
      const pending = reader.read();
      yield* Effect.promise(() => sleep(0));

      yield* Effect.promise(() => reader.cancel("response cancelled"));
      expect(cancelled).toEqual([]);
      expect(browserFlight.locked).toBe(false);
      const result = yield* Effect.promise(() => pending);
      expect(result.done).toBe(true);
      // Workers can now release the response scope and abort the SSR renderer.
      // Awaiting browserFlight.cancel above would deadlock until this step.
      yield* Effect.promise(() => ssrReader.cancel("request scope released"));
      const ssrResult = yield* Effect.promise(() => ssrPending);
      expect(ssrResult.done).toBe(true);
      expect(cancelled).toEqual([["request scope released", "response cancelled"]]);
      ssrReader.releaseLock();
    }),
  );

  it.effect("cancels both sources when the response is cancelled before HTML EOF", () =>
    Effect.gen(function* () {
      const cancelled: unknown[] = [];
      const html = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Encoder.encode("<html><body>shell"));
        },
        cancel(reason) {
          cancelled.push(["html", reason]);
        },
      });
      const flight = new ReadableStream<Uint8Array>({
        cancel(reason) {
          cancelled.push(["flight", reason]);
        },
      });
      const reader = html.pipeThrough(injectFlightPayload(flight)).getReader();
      yield* Effect.promise(() => reader.read());
      yield* Effect.promise(() => reader.cancel("response cancelled"));
      yield* Effect.promise(() => sleep(0));
      expect(cancelled).toEqual([
        ["flight", "response cancelled"],
        ["html", "response cancelled"],
      ]);
      expect(flight.locked).toBe(false);
    }),
  );

  it.effect("cancels unread Flight when HTML errors before EOF", () =>
    Effect.gen(function* () {
      const failure = new Error("HTML rendering failed");
      const cancelled: unknown[] = [];
      const flight = new ReadableStream<Uint8Array>({
        cancel(reason) {
          cancelled.push(reason);
        },
      });
      const html = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(failure);
        },
      });
      const reader = html.pipeThrough(injectFlightPayload(flight)).getReader();

      yield* Effect.promise(() => expect(reader.read()).rejects.toBe(failure));
      expect(cancelled).toEqual([failure]);
      expect(flight.locked).toBe(false);
    }),
  );
});
