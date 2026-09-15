import { describe, expect, it } from "@effect/vitest";
import { Context, Deferred, Effect, Exit, FiberSet, Layer, Ref, Scope } from "effect";
import type { ReactNode } from "react";

import { Application } from "./effront";
import { getEFFRONTIdentity } from "./effront-identity";

class ShellTitle extends Context.Service<ShellTitle, { readonly value: string }>()(
  "effront/tests/application/layout/ShellTitle",
) {}

const EFFRONT = Application.effront<ShellTitle>();

describe("EFFRONT.Layout.make", () => {
  it("rejects rendering outside its application request runtime", () => {
    const ServiceFreeEFFRONT = Application.effront();
    const Layout = ServiceFreeEFFRONT.Layout.make({
      render: ({ children }) => Effect.succeed(children),
    });

    expect(() => Layout({ children: null })).toThrow(
      new TypeError("EFFRONT Layout rendered outside its application request runtime."),
    );
  });

  it.effect("infers children as an immediately renderable node", () =>
    Effect.gen(function* () {
      const runtime = yield* FiberSet.makeRuntimePromise<never>();
      const ServiceFreeEFFRONT = Application.effront();
      const PassthroughLayout = ServiceFreeEFFRONT.Layout.make({
        render: ({ children }) => Effect.succeed(children),
      });
      const Page = ServiceFreeEFFRONT.Page.make({ render: () => Effect.succeed(null) });
      const App = ServiceFreeEFFRONT.make({
        routes: ServiceFreeEFFRONT.Routes.make({ layout: PassthroughLayout }).page("/", Page),
      });
      const child = <main>Home</main>;

      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(App).renderRuntime.bind(runtime, [], () =>
          PassthroughLayout({ children: child }),
        ),
      );

      expect(rendered).toBe(child);
    }),
  );

  it.effect("runs an Effect operation with children and request services", () =>
    Effect.gen(function* () {
      const runtime = yield* FiberSet.makeRuntimePromise<ShellTitle>();
      const LayoutComponent = EFFRONT.Layout.make({
        render: Effect.fn(function* ({ children }) {
          const inferredChildren: ReactNode = children;
          const title = yield* ShellTitle;
          return (
            <html lang="en">
              <head>
                <title>{title.value}</title>
              </head>
              <body>{inferredChildren}</body>
            </html>
          );
        }),
      });
      const Page = EFFRONT.Page.make({ render: () => Effect.succeed(null) });
      const App = EFFRONT.make({
        routes: EFFRONT.Routes.make({ layout: LayoutComponent }).page("/", Page),
        layer: Layer.succeed(ShellTitle, { value: "application title" }),
      });

      const rendered = yield* Effect.promise(() =>
        getEFFRONTIdentity(App).renderRuntime.bind(runtime, [], () =>
          LayoutComponent({ children: <main>Home</main> }),
        ),
      );

      expect(rendered).toEqual(
        <html lang="en">
          <head>
            <title>Request title</title>
          </head>
          <body>
            <main>Home</main>
          </body>
        </html>,
      );
    }).pipe(Effect.provideService(ShellTitle, { value: "Request title" })),
  );

  it.effect("interrupts the layout operation when its request scope closes", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Ref.make(false);
      const runtime = yield* FiberSet.makeRuntimePromise<never>().pipe(Scope.provide(scope));
      const InterruptEFFRONT = Application.effront();
      const LayoutComponent = InterruptEFFRONT.Layout.make({
        render: Effect.fn(function* (_props) {
          yield* Deferred.succeed(started, void 0);
          return yield* Effect.never.pipe(Effect.onInterrupt(() => Ref.set(interrupted, true)));
        }),
      });
      const Page = InterruptEFFRONT.Page.make({ render: () => Effect.succeed(null) });
      const App = InterruptEFFRONT.make({
        routes: InterruptEFFRONT.Routes.make({ layout: LayoutComponent }).page("/", Page),
      });
      const execution = getEFFRONTIdentity(App)
        .renderRuntime.bind(runtime, [], () => LayoutComponent({ children: null }))
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
