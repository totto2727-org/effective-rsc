// Vite replaces `import.meta.env.DEV` at compile time.
import { Context, Deferred, Effect, Exit, Layer, Schema, Scope, Stream } from "effect";
import { HttpBody, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { createFromReadableStream, createTemporaryReferenceSet } from "@vitejs/plugin-rsc/browser";

import { FlightMediaType, ServerFnIdHeader, type FlightPayload } from "../rsc/flight";
import { InitialFlightStream } from "./initial-flight-stream";

export class FlightLoadError extends Schema.TaggedError<FlightLoadError>()("FlightLoadError", {
  cause: Schema.Defect(),
  reason: Schema.Literals(["RequestFailed", "UnexpectedResponse", "DecodeFailed"]),
}) {}

export type FlightRequest =
  | {
      readonly _tag: "Navigation";
      readonly destination: URL;
    }
  | {
      readonly _tag: "ServerFunction";
      readonly body: BodyInit;
      readonly destination: URL;
      readonly id: string;
      readonly temporaryReferences: ReturnType<typeof createTemporaryReferenceSet>;
    };

type DecodedFlight = {
  readonly completed: Effect.Effect<void, FlightLoadError>;
  readonly payload: FlightPayload;
};

type FlightResource = DecodedFlight & {
  readonly _tag: "Flight";
  readonly release: Effect.Effect<void>;
  readonly resolvedUrl: URL;
};

type DocumentResource = {
  readonly _tag: "Document";
  readonly release: Effect.Effect<void>;
};

export class FlightClient extends Context.Service<FlightClient>()("effront/client/FlightClient", {
  make: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const initialFlight = yield* InitialFlightStream;

    const loadInitial = Effect.gen(function* () {
      const completed = Promise.withResolvers<void>();
      const stream = initialFlight.stream.pipeThrough(
        new TransformStream({
          flush: () => completed.resolve(),
          transform: (chunk, controller) => controller.enqueue(chunk),
        }),
      );
      const payload = yield* Effect.tryPromise({
        try: () =>
          createFromReadableStream<FlightPayload>(
            stream,
            import.meta.env.DEV ? { startTime: 0 } : undefined,
          ),
        catch: (cause) => new FlightLoadError({ cause, reason: "DecodeFailed" }),
      });

      return {
        completed: Effect.promise(() => completed.promise),
        payload,
      } satisfies DecodedFlight;
    });

    const load = Effect.fnUntraced(function* (flightRequest: FlightRequest) {
      const parentScope = yield* Effect.scope;
      const responseScope = yield* Scope.fork(parentScope);
      const release = Scope.close(responseScope, Exit.void);

      return yield* Effect.gen(function* () {
        const client = httpClient.pipe(HttpClient.withScope);
        const request =
          flightRequest._tag === "Navigation"
            ? HttpClientRequest.get(flightRequest.destination).pipe(
                HttpClientRequest.setHeader("accept", FlightMediaType),
              )
            : HttpClientRequest.post(flightRequest.destination).pipe(
                HttpClientRequest.setHeaders({
                  accept: FlightMediaType,
                  [ServerFnIdHeader]: flightRequest.id,
                }),
                HttpClientRequest.setBody(HttpBody.raw(flightRequest.body)),
              );
        const requestStartTime = import.meta.env.DEV ? performance.now() : 0;
        const response = yield* client.execute(request).pipe(
          Scope.provide(responseScope),
          Effect.mapError(
            (cause) =>
              new FlightLoadError({
                cause,
                reason: "RequestFailed",
              }),
          ),
        );
        if (response.status < 200 || response.status >= 300) {
          if (flightRequest._tag === "Navigation") {
            return { _tag: "Document", release } satisfies DocumentResource;
          }
          return yield* new FlightLoadError({
            cause: new Error(`Flight request failed with status ${response.status}.`),
            reason: "RequestFailed",
          });
        }
        const contentType = response.headers["content-type"]
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (contentType !== FlightMediaType) {
          if (flightRequest._tag === "Navigation") {
            return { _tag: "Document", release } satisfies DocumentResource;
          }
          return yield* new FlightLoadError({
            cause: new Error(
              `Expected a ${FlightMediaType} response, received ${response.headers["content-type"] ?? "no content type"}.`,
            ),
            reason: "UnexpectedResponse",
          });
        }

        if (response.url === "") {
          return yield* new FlightLoadError({
            cause: new Error("Expected the Flight response to include a resolved URL."),
            reason: "UnexpectedResponse",
          });
        }
        const resolvedUrl = yield* Effect.try({
          try: () => new URL(response.url),
          catch: (cause) =>
            new FlightLoadError({
              cause,
              reason: "UnexpectedResponse",
            }),
        });

        const completed = yield* Deferred.make<void, FlightLoadError>();
        const responseBody = yield* Stream.toReadableStreamEffect(
          response.stream.pipe(
            Stream.onExit((exit) =>
              Deferred.done(
                completed,
                exit.pipe(
                  Exit.mapError(
                    (cause) =>
                      new FlightLoadError({
                        cause,
                        reason: "RequestFailed",
                      }),
                  ),
                  Exit.asVoid,
                ),
              ),
            ),
            Stream.ensuring(release),
          ),
        );
        const decodeOptions =
          flightRequest._tag === "ServerFunction"
            ? import.meta.env.DEV
              ? {
                  startTime: requestStartTime,
                  temporaryReferences: flightRequest.temporaryReferences,
                }
              : { temporaryReferences: flightRequest.temporaryReferences }
            : import.meta.env.DEV
              ? {
                  startTime: requestStartTime,
                }
              : undefined;
        const payload = yield* Effect.tryPromise({
          try: () => createFromReadableStream<FlightPayload>(responseBody, decodeOptions),
          catch: (cause) =>
            new FlightLoadError({
              cause,
              reason: "DecodeFailed",
            }),
        });

        return {
          _tag: "Flight",
          completed: Deferred.await(completed),
          payload,
          release,
          resolvedUrl,
        } satisfies FlightResource;
      }).pipe(Effect.onError(() => release));
    });

    return { load, loadInitial };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);

  static readonly layerTest = Layer.mock(this);
}
