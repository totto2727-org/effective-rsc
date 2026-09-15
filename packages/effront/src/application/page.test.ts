import { describe, expect, it } from "@effect/vitest";
import {
  Context,
  Deferred,
  Effect,
  Exit,
  FiberSet,
  Layer,
  Ref,
  Schema,
  SchemaTransformation,
  Scope,
} from "effect";

import { Application } from "./effront";
import { getEFFRONTIdentity } from "./effront-identity";
import { getPageState } from "./page";

class Greeting extends Context.Service<Greeting, { readonly value: string }>()(
  "effront/tests/application/page/Greeting",
) {}

const EFFRONT = Application.effront<Greeting>();
const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });

describe("EFFRONT.Page.make", () => {
  it("rejects rendering outside its application request runtime", () => {
    const ServiceFreeEFFRONT = Application.effront();
    const Page = ServiceFreeEFFRONT.Page.make({ render: () => Effect.succeed(null) });

    expect(() => getPageState(Page).component({ params: { _tag: "Encoded", value: {} } })).toThrow(
      new TypeError("EFFRONT Page rendered outside its application request runtime."),
    );
  });

  it.effect("decodes dynamic route params before invoking the render operation", () =>
    Effect.gen(function* () {
      const runtime = yield* FiberSet.makeRuntimePromise<Greeting>();
      const PageComponent = EFFRONT.Page.make({
        params: Schema.Struct({
          day: Schema.Literals(["saturday", "sunday"]),
        }),
        render: Effect.fn(function* ({ params }) {
          const greeting = yield* Greeting;
          return `${greeting.value} ${params.day}`;
        }),
      });
      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(PageComponent).renderRuntime.bind(runtime, [], () =>
          getPageState(PageComponent).component({
            params: { _tag: "Encoded", value: { day: "sunday" } },
          }),
        ),
      );

      expect(rendered).toBe("hello sunday");
      expect(getPageState(PageComponent).paramsSchema).not.toBeNull();
      expect(Object.isFrozen(PageComponent)).toBe(true);
    }).pipe(Effect.provideService(Greeting, { value: "hello" })),
  );

  it.effect("runs an Effect.fn operation with request services", () =>
    Effect.gen(function* () {
      const runtime = yield* FiberSet.makeRuntimePromise<Greeting>();
      const PageComponent = EFFRONT.Page.make({
        render: Effect.fn(function* () {
          const greeting = yield* Greeting;
          return greeting.value;
        }),
      });
      const App = EFFRONT.make({
        routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", PageComponent),
        layer: Layer.succeed(Greeting, { value: "application greeting" }),
      });

      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(App).renderRuntime.bind(runtime, [], () =>
          getPageState(PageComponent).component({ params: { _tag: "Encoded", value: {} } }),
        ),
      );

      expect(rendered).toBe("hello from the request");
      expect(getPageState(PageComponent).paramsSchema).toBeNull();
    }).pipe(Effect.provideService(Greeting, { value: "hello from the request" })),
  );

  it.effect("decodes encoded path keys into the Schema output consumed by render", () =>
    Effect.gen(function* () {
      const runtime = yield* FiberSet.makeRuntimePromise<never>();
      const TransformEFFRONT = Application.effront();
      const PageComponent = TransformEFFRONT.Page.make({
        params: Schema.Struct({ slug: Schema.String }).pipe(
          Schema.decodeTo(
            Schema.Struct({ id: Schema.String }),
            SchemaTransformation.transform({
              decode: ({ slug }) => ({ id: slug }),
              encode: ({ id }) => ({ slug: id }),
            }),
          ),
        ),
        render: ({ params }) => Effect.succeed(params.id),
      });
      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(PageComponent).renderRuntime.bind(runtime, [], () =>
          getPageState(PageComponent).component({
            params: { _tag: "Encoded", value: { slug: "opening-keynote" } },
          }),
        ),
      );

      expect(rendered).toBe("opening-keynote");
    }),
  );

  it.effect("interrupts the page operation when its request scope closes", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Ref.make(false);
      const runtime = yield* FiberSet.makeRuntimePromise<never>().pipe(Scope.provide(scope));
      const InterruptEFFRONT = Application.effront();
      const InterruptLayout = InterruptEFFRONT.Layout.make({
        render: ({ children }) => Effect.succeed(children),
      });
      const InterruptPage = InterruptEFFRONT.Page.make({
        render: () =>
          Deferred.succeed(started, void 0).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Ref.set(interrupted, true)),
          ),
      });
      const App = InterruptEFFRONT.make({
        routes: InterruptEFFRONT.Routes.make({ layout: InterruptLayout }).page("/", InterruptPage),
      });
      const execution = getEFFRONTIdentity(App)
        .renderRuntime.bind(runtime, [], () =>
          getPageState(InterruptPage).component({ params: { _tag: "Encoded", value: {} } }),
        )
        .then(
          () => "completed" as const,
          () => "interrupted" as const,
        );

      yield* Deferred.await(started);
      yield* Scope.close(scope, Exit.void);

      const result = yield* Effect.promise(() => execution);
      const wasInterrupted = yield* Ref.get(interrupted);
      expect(result).toBe("interrupted");
      expect(wasInterrupted).toBe(true);
    }),
  );
});
