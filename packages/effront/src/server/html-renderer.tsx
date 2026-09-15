import { Context, Effect, Layer, Schema, type Scope } from "effect";

import type { FlightPayload } from "../rsc/flight";
import type { FlightRender } from "./flight-renderer";

declare global {
  interface ImportMeta {
    readonly viteRsc: {
      loadModule<T>(environment: string, entry: string): Promise<T>;
    };
  }
}

export type HtmlRenderOptions = {
  readonly formState: FlightPayload["formState"];
  readonly signal: AbortSignal;
};

export type RenderHtml = (
  stream: ReadableStream<Uint8Array>,
  options: HtmlRenderOptions,
) => Promise<ReadableStream<Uint8Array>>;

export class HtmlRenderError extends Schema.TaggedError<HtmlRenderError>()("HtmlRenderError", {
  cause: Schema.Defect(),
}) {}

export class HtmlRenderer extends Context.Service<HtmlRenderer>()(
  "effront/server/html-renderer/HtmlRenderer",
  {
    make: Effect.succeed({
      render: Effect.fnUntraced(function* ({
        flight,
        formState,
      }: {
        readonly flight: FlightRender;
        readonly formState: FlightPayload["formState"];
      }): Effect.fn.Return<ReadableStream<Uint8Array>, HtmlRenderError, Scope.Scope> {
        const signal = yield* Effect.abortSignal;
        return yield* Effect.tryPromise({
          try: async () => {
            const ssr = await import.meta.viteRsc.loadModule<typeof import("./ssr")>(
              "ssr",
              "index",
            );
            return ssr.renderHtml(flight.stream, { formState, signal });
          },
          catch: (cause) => new HtmlRenderError({ cause }),
        });
      }),
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
