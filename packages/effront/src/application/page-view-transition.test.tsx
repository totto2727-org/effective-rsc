import { describe, expect, it } from "@effect/vitest";
import { Effect, FiberSet, Layer, Schema } from "effect";
import { isValidElement, type ReactNode } from "react";

import { Application } from "./effront";
import { getEFFRONTIdentity } from "./effront-identity";
import { getPageState } from "./page";
import {
  PageViewTransition,
  type PageViewTransitionConfig,
  resolvePageViewTransition,
} from "./page-view-transition";
import { PageViewTransitionBoundary } from "../client/page-view-transition";

const boundaryConfig = (node: ReactNode) => {
  if (!isValidElement<{ config: PageViewTransitionConfig; children: ReactNode }>(node)) {
    throw new TypeError("Expected the client transition boundary.");
  }
  expect(node.type).toBe(PageViewTransitionBoundary);
  expect(node.props.children).toBe("page content");
  return node.props.config;
};

const renderBoundary = (override?: false | PageViewTransitionConfig, parameterized = false) =>
  Effect.gen(function* () {
    const EFFRONT = Application.effront();
    const page = parameterized
      ? EFFRONT.Page.make({
          params: Schema.Struct({ slug: Schema.String }),
          viewTransition: override,
          render: () => Effect.succeed(null),
        })
      : EFFRONT.Page.make({ viewTransition: override, render: () => Effect.succeed(null) });
    const runtime = yield* FiberSet.makeRuntimePromise<never>();
    const node = yield* Effect.promise(() =>
      getEFFRONTIdentity(page).renderRuntime.bind(runtime, [], () =>
        getPageState(page).boundary({ children: "page content" }),
      ),
    );
    return boundaryConfig(node);
  });

describe("PageViewTransition settings", () => {
  it.effect("enables page transitions without requiring a service Layer", () =>
    Effect.gen(function* () {
      expect((yield* PageViewTransition).default).toEqual({
        default: "auto",
        "hmr-refresh": "none",
        "navigation-ua-visual-transition": "none",
      });
      expect((yield* renderBoundary()).enabled).not.toBe(false);
    }),
  );

  it.effect("reads application Layer settings in the request render runtime", () =>
    Effect.gen(function* () {
      expect(yield* renderBoundary()).toMatchObject({ enabled: false, default: "application" });
    }).pipe(
      Effect.provide(Layer.succeed(PageViewTransition, { enabled: false, default: "application" })),
    ),
  );

  it.effect("allows static and parameterized pages to disable or re-enable transitions", () =>
    Effect.gen(function* () {
      for (const parameterized of [false, true]) {
        expect(yield* renderBoundary(false, parameterized)).toEqual({ enabled: false });
        expect(
          yield* renderBoundary({ enabled: true, share: "page-share" }, parameterized),
        ).toMatchObject({
          enabled: true,
          default: "application",
          share: "page-share",
        });
      }
    }).pipe(
      Effect.provide(Layer.succeed(PageViewTransition, { enabled: false, default: "application" })),
    ),
  );

  it.effect("keeps concurrent request overrides isolated", () =>
    Effect.gen(function* () {
      const results = yield* Effect.all(
        ["first", "second"].map((defaultClass) =>
          renderBoundary().pipe(
            Effect.provideService(PageViewTransition, { default: defaultClass }),
          ),
        ),
        { concurrency: "unbounded" },
      );
      expect(results.map((result) => result.default)).toEqual(["first", "second"]);
      expect((yield* renderBoundary()).default).toEqual((yield* PageViewTransition).default);
    }),
  );

  it.effect("retains the built-in type policy with a partial application Layer", () =>
    Effect.gen(function* () {
      expect(yield* renderBoundary()).toMatchObject({
        enter: "application-enter",
        default: {
          default: "auto",
          "hmr-refresh": "none",
          "navigation-ua-visual-transition": "none",
        },
      });
    }).pipe(Effect.provide(Layer.succeed(PageViewTransition, { enter: "application-enter" }))),
  );

  it("shallowly replaces type maps and forwards only public settings", () => {
    const defaults = {
      default: "global",
      share: { default: "fade", "navigation-back": "back" },
      privateValue: "not-flight",
    };
    expect(resolvePageViewTransition(defaults, { share: { default: "page" } })).toEqual({
      enabled: undefined,
      default: "global",
      enter: undefined,
      exit: undefined,
      share: { default: "page" },
      update: undefined,
    });
  });
});
