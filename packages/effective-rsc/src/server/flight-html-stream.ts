// Adapted from rsc-html-stream by Devon Govett.
// Copyright (c) 2024-present Devon Govett. Licensed under the MIT License; see vendor/rsc-html-stream/LICENSE.

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
    const text = decoder.decode(chunk, { stream: true });
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
  stream: ReadableStream<Uint8Array>,
  controller: StreamController,
  nonce: string | undefined,
) => {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        const finalText = decoder.decode();
        if (finalText.length > 0) {
          writeFlightValue(JSON.stringify(finalText), controller, nonce);
        }
        return;
      }
      writeFlightChunk(decoder, result.value, controller, nonce);
    }
  } finally {
    reader.releaseLock();
  }
};

const makeHtmlWriter = () => {
  let tail = emptyBytes;

  return {
    finish(controller: StreamController) {
      if (tail.byteLength !== htmlTrailer.byteLength && tail.byteLength > 0) {
        controller.enqueue(tail);
      }
      controller.enqueue(htmlTrailer);
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
  let flight: Promise<void> | undefined;

  const startFlight = (controller: StreamController) => {
    flight ??= writeFlightStream(flightStream, controller, options?.nonce);
    return flight;
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    async flush(controller) {
      try {
        await startFlight(controller);
        htmlWriter.finish(controller);
      } catch (cause) {
        controller.error(cause);
      }
    },
    transform(chunk, controller) {
      htmlWriter.write(chunk, controller);
      void startFlight(controller).catch((cause: unknown) => controller.error(cause));
    },
  });
};
