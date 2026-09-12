import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Stream } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

import { Application } from "../../src/application/effront";
import {
  createFetchHandler,
  createWorkersContextAccessors,
  getWorkersRequestContext,
} from "../../src/workers";

class RequestEnvironment extends Context.Service<RequestEnvironment, { readonly value: string }>()(
  "effront/tests/workers/RequestEnvironment",
) {}

class RequestLifetime extends Context.Service<
  RequestLifetime,
  { readonly events: Array<string> }
>()("effront/tests/workers/RequestLifetime") {}

type TestEnv = { readonly mode?: "empty" | "failure" | "stream"; readonly value: string };

const accessors = createWorkersContextAccessors<TestEnv, { readonly requestId: string }>();
const encoder = new TextEncoder();

describe("createFetchHandler", () => {
  it.effect(
    "builds application services from each request environment and releases at response EOF",
    () =>
      Effect.gen(function* () {
        const events: Array<string> = [];
        const EFFRONT = Application.effront<RequestEnvironment | RequestLifetime>();
        const Respond = EFFRONT.Middleware.make(() =>
          Effect.gen(function* () {
            const environment = yield* RequestEnvironment;
            const lifetime = yield* RequestLifetime;
            const requestContext = yield* accessors.getWorkersRequestContext();
            expect(requestContext).toBe(yield* getWorkersRequestContext());
            if (requestContext.env.mode === "empty") {
              return HttpServerResponse.empty();
            }
            if (requestContext.env.mode === "failure") {
              return HttpServerResponse.stream(
                Stream.fromReadableStream({
                  evaluate: () =>
                    new ReadableStream<Uint8Array>({
                      start(controller) {
                        controller.error(new Error("intentional stream failure"));
                      },
                    }),
                  onError: (cause) => cause,
                }),
              );
            }
            if (requestContext.env.mode === "stream") {
              return HttpServerResponse.stream(
                Stream.fromReadableStream({
                  evaluate: () =>
                    new ReadableStream<Uint8Array>({
                      pull(controller) {
                        controller.enqueue(encoder.encode(environment.value));
                        return new Promise<void>(() => {});
                      },
                    }),
                  onError: (cause) => cause,
                }),
              );
            }
            return HttpServerResponse.text(
              `${environment.value}|${requestContext.executionContext.requestId}|${requestContext.request.url}`,
            ).pipe(HttpServerResponse.setHeader("x-events", lifetime.events.join(",")));
          }),
        );
        const Layout = EFFRONT.Layout.make({
          render: ({ children }) => Effect.succeed(<html lang="en">{children}</html>),
        });
        const Page = EFFRONT.Page.make({
          render: () => Effect.die("Workers test middleware must short-circuit rendering."),
        });
        const App = EFFRONT.make({
          layer: Layer.mergeAll(
            Layer.effect(
              RequestEnvironment,
              Effect.map(accessors.getWorkersEnv(), (env) =>
                RequestEnvironment.of({ value: env.value }),
              ),
            ),
            Layer.effect(
              RequestLifetime,
              Effect.acquireRelease(
                Effect.sync(() => {
                  events.push("acquired");
                  return RequestLifetime.of({ events });
                }),
                () =>
                  Effect.sync(() => {
                    events.push("released");
                  }),
              ),
            ),
          ),
          routes: EFFRONT.withMiddleware(Respond).Routes.make({ layout: Layout }).page("/", Page),
        });
        const handler = createFetchHandler(App);

        const [first, second] = yield* Effect.promise(() =>
          Promise.all([
            handler(
              new Request("https://workers.test/?request=first"),
              { value: "first" },
              { requestId: "one" },
            ),
            handler(
              new Request("https://workers.test/?request=second"),
              { value: "second" },
              { requestId: "two" },
            ),
          ]),
        );
        expect(yield* Effect.promise(() => first.text())).toBe(
          "first|one|https://workers.test/?request=first",
        );
        expect(yield* Effect.promise(() => second.text())).toBe(
          "second|two|https://workers.test/?request=second",
        );
        expect(events).toEqual(["acquired", "acquired", "released", "released"]);

        const empty = yield* Effect.promise(() =>
          handler(
            new Request("https://workers.test/?request=empty"),
            { mode: "empty", value: "empty" },
            { requestId: "empty" },
          ),
        );
        expect(empty.body).toBeNull();
        expect(events).toEqual([
          "acquired",
          "acquired",
          "released",
          "released",
          "acquired",
          "released",
        ]);

        const streaming = yield* Effect.promise(() =>
          handler(
            new Request("https://workers.test/?request=stream"),
            { mode: "stream", value: "stream" },
            { requestId: "stream" },
          ),
        );
        expect(streaming.body).not.toBeNull();
        yield* Effect.promise(() => streaming.body!.cancel());
        expect(events).toEqual([
          "acquired",
          "acquired",
          "released",
          "released",
          "acquired",
          "released",
          "acquired",
          "released",
        ]);

        const failing = yield* Effect.promise(() =>
          handler(
            new Request("https://workers.test/?request=failure"),
            { mode: "failure", value: "failure" },
            { requestId: "failure" },
          ),
        );
        yield* Effect.promise(() =>
          failing.text().then(
            () => Promise.reject(new Error("Expected stream failure.")),
            () => undefined,
          ),
        );
        expect(events.filter((event) => event === "released")).toHaveLength(5);
      }),
  );
});
