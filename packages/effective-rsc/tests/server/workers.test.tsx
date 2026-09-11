import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

import { Application } from "../../src/application/ersc";
import { createFetchHandler, getWorkersEnv } from "../../src/workers";

class RequestEnvironment extends Context.Service<RequestEnvironment, { readonly value: string }>()(
  "ersc/tests/workers/RequestEnvironment",
) {}

class RequestLifetime extends Context.Service<
  RequestLifetime,
  { readonly events: Array<string> }
>()("ersc/tests/workers/RequestLifetime") {}

describe("createFetchHandler", () => {
  it.effect(
    "builds application services from each request environment and releases at response EOF",
    () =>
      Effect.gen(function* () {
        const events: Array<string> = [];
        const ERSC = Application.ersc<RequestEnvironment | RequestLifetime>();
        const Respond = ERSC.Middleware.make(() =>
          Effect.gen(function* () {
            const environment = yield* RequestEnvironment;
            const lifetime = yield* RequestLifetime;
            return HttpServerResponse.text(environment.value).pipe(
              HttpServerResponse.setHeader("x-events", lifetime.events.join(",")),
            );
          }),
        );
        const Layout = ERSC.Layout.make({
          render: ({ children }) => Effect.succeed(<html lang="en">{children}</html>),
        });
        const Page = ERSC.Page.make({
          render: () => Effect.die("Workers test middleware must short-circuit rendering."),
        });
        const App = ERSC.make({
          layer: Layer.mergeAll(
            Layer.effect(
              RequestEnvironment,
              Effect.map(getWorkersEnv<{ readonly value: string }>(), (env) =>
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
          routes: ERSC.withMiddleware(Respond).Routes.make({ layout: Layout }).page("/", Page),
        });
        const handler = createFetchHandler(App);

        const first = yield* Effect.promise(() =>
          handler(new Request("https://workers.test/"), { value: "first" }, {}),
        );
        expect(events).toEqual(["acquired"]);
        expect(yield* Effect.promise(() => first.text())).toBe("first");
        expect(events).toEqual(["acquired", "released"]);

        const second = yield* Effect.promise(() =>
          handler(new Request("https://workers.test/"), { value: "second" }, {}),
        );
        expect(yield* Effect.promise(() => second.text())).toBe("second");
        expect(events).toEqual(["acquired", "released", "acquired", "released"]);
      }),
  );
});
