// Adapted from rsc-html-stream by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see THIRD-PARTY-NOTICES.md.

const encoder = new TextEncoder();
const htmlTrailer = encoder.encode("</body></html>");
const emptyBytes = new Uint8Array();

type StreamController = TransformStreamDefaultController<Uint8Array>;

export type FlightHtmlStreamOptions = {
  readonly nonce?: string;
};

const trailerPrefixLength = (bytes: Uint8Array) => {
  const maximumLength = Math.min(bytes.byteLength, htmlTrailer.byteLength);
  for (let length = maximumLength; length > 0; length -= 1) {
    const offset = bytes.byteLength - length;
    let matches = true;
    for (let index = 0; index < length; index += 1) {
      if (bytes[offset + index] !== htmlTrailer[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return length;
    }
  }
  return 0;
};

const escapeInlineScript = (script: string) =>
  script.replace(/<!--|<\/script/gi, (match) =>
    match === "<!--" ? "<\\!--" : `</\\${match.slice(2)}`,
  );

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

const writeFlightValue = (
  value: string,
  controller: StreamController,
  nonce: string | undefined,
) => {
  const script = escapeInlineScript(`(self.__FLIGHT_DATA||=[]).push(${value})`);
  const nonceAttribute = nonce === undefined ? "" : ` nonce="${nonce}"`;
  controller.enqueue(encoder.encode(`<script${nonceAttribute}>${script}</script>`));
};

const writeFlightChunk = (
  decoder: TextDecoder,
  chunk: Uint8Array,
  controller: StreamController,
  nonce: string | undefined,
) => {
  try {
    // Decode each chunk independently: a streaming fatal decoder can discard pending
    // bytes from the previous chunk when the next chunk contains binary Flight data.
    // Incomplete UTF-8 is therefore encoded as bytes, just like other binary data.
    const text = decoder.decode(chunk);
    if (text.length > 0) {
      writeFlightValue(JSON.stringify(text), controller, nonce);
    }
  } catch {
    writeFlightValue(
      `Uint8Array.from(atob(${JSON.stringify(toBase64(chunk))}),character=>character.codePointAt(0))`,
      controller,
      nonce,
    );
  }
};

const writeFlightStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: StreamController,
  nonce: string | undefined,
) => {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  while (true) {
    const result = await reader.read();
    if (result.done) {
      return;
    }
    writeFlightChunk(decoder, result.value, controller, nonce);
  }
};

const makeHtmlWriter = () => {
  let tail = emptyBytes;

  return {
    finish(controller: StreamController) {
      if (tail.byteLength !== htmlTrailer.byteLength && tail.byteLength > 0) {
        controller.enqueue(tail);
      }
    },
    write(chunk: Uint8Array, controller: StreamController) {
      const combined = new Uint8Array(tail.byteLength + chunk.byteLength);
      combined.set(tail);
      combined.set(chunk, tail.byteLength);
      const bodyLength = combined.byteLength - trailerPrefixLength(combined);
      if (bodyLength > 0) {
        controller.enqueue(combined.subarray(0, bodyLength));
      }
      tail = combined.slice(bodyLength);
    },
  };
};

export const injectFlightPayload = (
  flightStream: ReadableStream<Uint8Array>,
  options?: FlightHtmlStreamOptions,
) => {
  const htmlWriter = makeHtmlWriter();
  const flightReader = flightStream.getReader();
  let flightReleased = false;
  const releaseFlight = () => {
    if (!flightReleased) {
      flightReleased = true;
      flightReader.releaseLock();
    }
  };
  const cancelFlight = (reason: unknown) => {
    if (!flightReleased) {
      // Cancelling a tee branch settles its pending reads immediately, but the
      // cancellation promise waits for the sibling. Do not block request-scope
      // release on that sibling, which can itself need the scope's abort signal.
      void flightReader.cancel(reason).catch(() => {});
      releaseFlight();
    }
  };

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    async flush(controller) {
      try {
        htmlWriter.finish(controller);
        // HTML chunks are arbitrary bytes, not parser boundaries. Only HTML EOF is
        // safe for injection without a tokenizer. The SSR tee branch keeps pulling
        // Flight while its browser branch queues, so HTML still streams normally.
        await writeFlightStream(flightReader, controller, options?.nonce);
        controller.enqueue(htmlTrailer);
      } catch (cause) {
        controller.error(cause);
      } finally {
        releaseFlight();
      }
    },
    transform(chunk, controller) {
      htmlWriter.write(chunk, controller);
    },
  });

  const htmlReader = transform.readable.getReader();
  let ended = false;
  // A TransformStream cancellation can wait for an already-running flush.
  // Intercept it before that wait so a pending Flight read cannot deadlock
  // cancellation of the response body and its request-local services.
  const readable = new ReadableStream<Uint8Array>({
    async cancel(reason) {
      ended = true;
      cancelFlight(reason);
      try {
        await htmlReader.cancel(reason);
      } finally {
        htmlReader.releaseLock();
      }
    },
    async pull(controller) {
      try {
        const result = await htmlReader.read();
        if (ended) {
          return;
        }
        if (result.done) {
          ended = true;
          controller.close();
          htmlReader.releaseLock();
        } else {
          controller.enqueue(result.value);
        }
      } catch (cause) {
        ended = true;
        cancelFlight(cause);
        controller.error(cause);
        htmlReader.releaseLock();
      }
    },
  });

  return { readable, writable: transform.writable };
};
