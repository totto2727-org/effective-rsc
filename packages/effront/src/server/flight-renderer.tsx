import { Context, Effect, Exit, FiberSet, Layer, Scope } from "effect";
import type { createTemporaryReferenceSet } from "@vitejs/plugin-rsc/rsc/server";

import type { AnyMiddleware } from "../application/middleware";
import type { RenderRuntimeContext } from "../application/render-runtime";
import type { FlightPayload, ServerFnResult } from "../rsc/flight";
import type { RouteTreeModel } from "../rsc/route-tree";

type FlightStream = ReadableStream<Uint8Array>;

export type FlightRender = {
  readonly release: Effect.Effect<void>;
  readonly signal: AbortSignal;
  readonly stream: FlightStream;
};

export type FlightRenderOptions<Services> = {
  readonly formState: FlightPayload["formState"];
  readonly middleware: ReadonlyArray<AnyMiddleware<Services>>;
  readonly renderRuntime: RenderRuntimeContext;
  readonly routeTree: RouteTreeModel;
  readonly serverFnResult: ServerFnResult | null;
  readonly temporaryReferences?: ReturnType<typeof createTemporaryReferenceSet>;
};

export class FlightRenderer extends Context.Service<FlightRenderer>()(
  "effront/server/flight-renderer/FlightRenderer",
  {
    make: Effect.succeed({
      render: Effect.fnUntraced(function* <Services>({
        formState,
        middleware,
        renderRuntime,
        routeTree,
        serverFnResult,
        temporaryReferences,
      }: FlightRenderOptions<Services>): Effect.fn.Return<
        FlightRender,
        never,
        Services | Scope.Scope
      > {
        const parentScope = yield* Effect.scope;
        const renderScope = yield* Scope.fork(parentScope);
        const release = Scope.close(renderScope, Exit.void);
        return yield* Effect.gen(function* () {
          const runtime = yield* FiberSet.makeRuntimePromise<Services>().pipe(
            Scope.provide(renderScope),
          );
          const signal = yield* Effect.abortSignal.pipe(Scope.provide(renderScope));
          const { renderToReadableStream } = yield* Effect.promise(
            () => import("@vitejs/plugin-rsc/rsc/server"),
          );
          const stream = renderRuntime.bind(runtime, middleware, () => {
            const payload = { formState, routeTree, serverFnResult } satisfies FlightPayload;
            return renderToReadableStream(payload, {
              onError: (error: unknown) => {
                if (!signal.aborted) {
                  void runtime(Effect.logError(error));
                }
              },
              signal,
              temporaryReferences,
            });
          });
          return { release, signal, stream } satisfies FlightRender;
        }).pipe(Effect.onError(() => release));
      }),
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
