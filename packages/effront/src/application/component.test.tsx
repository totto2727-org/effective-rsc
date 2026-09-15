import { describe, expect, it } from "@effect/vitest";
import { Context, Deferred, Effect, Exit, FiberSet, Ref, Scope } from "effect";

import { Application } from "./effront";
import { getEFFRONTIdentity } from "./effront-identity";
import type { RenderRuntime } from "./render-runtime";

class Greeting extends Context.Service<Greeting, { readonly prefix: string }>()(
  "effront/tests/application/component/Greeting",
) {}

describe("EFFRONT.Component.make", () => {
  it("rejects rendering outside its application request runtime", () => {
    const EFFRONT = Application.effront();
    const Component = EFFRONT.Component.make({ render: () => Effect.succeed(null) });

    expect(() => Component({})).toThrow(
      new TypeError("EFFRONT Component rendered outside its application request runtime."),
    );
  });

  it.effect("runs props and services through the request runtime", () =>
    Effect.gen(function* () {
      const EFFRONT = Application.effront<Greeting>();
      const runtime = yield* FiberSet.makeRuntimePromise<Greeting>();
      const GreetingComponent = EFFRONT.Component.make({
        render: Effect.fn(function* ({ name }: { readonly name: string }) {
          const greeting = yield* Greeting;
          return <p>{`${greeting.prefix}, ${name}`}</p>;
        }),
      });

      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(EFFRONT).renderRuntime.bind(runtime, [], () =>
          GreetingComponent({ name: "Nikhil" }),
        ),
      );

      expect(rendered).toEqual(<p>Hello, Nikhil</p>);
    }).pipe(Effect.provideService(Greeting, { prefix: "Hello" })),
  );

  it.effect("rejects rendering outside its authored middleware scope", () =>
    Effect.gen(function* () {
      const EFFRONT = Application.effront();
      const RequireScope = EFFRONT.Middleware.make((httpEffect) => httpEffect);
      const ScopedEFFRONT = EFFRONT.withMiddleware(RequireScope);
      const Component = ScopedEFFRONT.Component.make({ render: () => Effect.succeed("scoped") });
      const runtime = yield* FiberSet.makeRuntimePromise<never>();
      const renderRuntime = getEFFRONTIdentity(EFFRONT).renderRuntime;

      expect(() => renderRuntime.bind(runtime, [], () => Component({}))).toThrow(
        new TypeError(
          "EFFRONT Component requires a middleware scope that is not active for this request.",
        ),
      );
      const rendered = yield* Effect.promise(() =>
        renderRuntime.bind(runtime, [RequireScope], () => Component({})),
      );
      expect(rendered).toBe("scoped");
    }),
  );

  it.effect("invokes the authored renderer from inside Effect execution", () =>
    Effect.gen(function* () {
      const EFFRONT = Application.effront();
      let runtimeEntered = false;
      const runtime: RenderRuntime<never> = (effect) => {
        runtimeEntered = true;
        // custom request runner under test
        return Effect.runPromise(effect).finally(() => {
          runtimeEntered = false;
        });
      };
      const Component = EFFRONT.Component.make({
        render: () => {
          expect(runtimeEntered).toBe(true);
          return Effect.succeed(<p>Rendered</p>);
        },
      });

      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(EFFRONT).renderRuntime.bind(runtime, [], () => Component({})),
      );

      expect(rendered).toEqual(<p>Rendered</p>);
      expect(runtimeEntered).toBe(false);
    }),
  );

  it.effect("interrupts component work when its request scope closes", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Ref.make(false);
      const runtime = yield* FiberSet.makeRuntimePromise<never>().pipe(Scope.provide(scope));
      const EFFRONT = Application.effront();
      const Component = EFFRONT.Component.make({
        render: Effect.fn(function* () {
          yield* Deferred.succeed(started, void 0);
          return yield* Effect.never.pipe(Effect.onInterrupt(() => Ref.set(interrupted, true)));
        }),
      });
      const execution = getEFFRONTIdentity(EFFRONT)
        .renderRuntime.bind(runtime, [], () => Component({}))
        .then(
          () => "completed" as const,
          () => "interrupted" as const,
        );

      yield* Deferred.await(started);
      yield* Scope.close(scope, Exit.void);

      const result = yield* Effect.promise(() => execution);
      expect(result).toBe("interrupted");
      const wasInterrupted = yield* Ref.get(interrupted);
      expect(wasInterrupted).toBe(true);
    }),
  );
});
