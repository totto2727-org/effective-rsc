import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Schema } from "effect";
import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";

import { type ApplicationDefinition, getApplicationState } from "../../src/application/definition";
import { Application } from "../../src/application/effront";
import {
  type AnyPageDefinition,
  getPageState,
  type EncodedPageParams,
  type PageRuntimeProps,
} from "../../src/application/page";
import type { CompiledDestination } from "../../src/application/route-graph";
import type { AbsolutePath } from "../../src/application/route-path";
import { getRoutesState } from "../../src/application/routes";
import { RouteOutlet } from "../../src/client/route-tree";
import { renderRouteTree } from "../../src/rsc/render-route-tree";
import type { RouteTreeModel } from "../../src/rsc/route-tree";

const asElement = <Props,>(node: ReactNode): ReactElement<Props> => {
  if (!isValidElement<Props>(node)) {
    throw new Error("Expected a React element.");
  }
  return node;
};

const pageContent = (node: RouteTreeModel) =>
  asElement<PageRuntimeProps>(
    asElement<{ readonly children: ReactNode }>(node.content).props.children,
  );

const requiredChild = (node: RouteTreeModel) => {
  if (node.child === null) {
    throw new Error(`Expected route node "${node.id}" to contain a child.`);
  }
  return node.child;
};

const findDestination = <Services,>(
  routes: ReadonlyArray<CompiledDestination<Services>>,
  pattern: AbsolutePath,
) => {
  const destination = routes.find((route) => route.pattern === pattern);
  if (destination === undefined) {
    throw new Error(`Expected a compiled destination for "${pattern}".`);
  }
  return destination;
};

const renderApplicationRoute = <Services,>(
  routes: ReadonlyArray<CompiledDestination<Services>>,
  pattern: AbsolutePath,
  pathname: AbsolutePath = pattern,
  encodedParams: EncodedPageParams = {},
) =>
  renderRouteTree({
    destination: findDestination(routes, pattern),
    pathname,
    params: { _tag: "Encoded", value: encodedParams },
  });

const applicationRoutes = <Services, ApplicationError>(
  application: ApplicationDefinition<Services, ApplicationError>,
) => getApplicationState(application).routes;

const pageComponent = <Services,>(page: AnyPageDefinition<Services>) =>
  getPageState(page).component;

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});
const ScheduleLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <section>
        <aside>Schedule navigation</aside>
        {children}
      </section>,
    ),
});
const ScheduleLoading = EFFRONT.Loading.make({ render: () => <p>Loading schedule...</p> });
const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Home</h1>) });
const SaturdayPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Saturday</h1>) });
const SundayPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Sunday</h1>) });

class LayoutService extends Context.Service<LayoutService, object>()(
  "effront/tests/application/LayoutService",
) {}

class PageService extends Context.Service<PageService, object>()(
  "effront/tests/application/PageService",
) {}

class NestedPageService extends Context.Service<NestedPageService, object>()(
  "effront/tests/application/NestedPageService",
) {}

describe("EFFRONT.make", () => {
  it("renders a root Layout around its exact Page", () => {
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
    });
    const rootNode = renderApplicationRoute(applicationRoutes(App), "/");
    const root = asElement<{ readonly children: ReactNode }>(rootNode.content);
    const pageNode = requiredChild(rootNode);

    expect(rootNode.id).not.toBe(pageNode.id);
    expect(root.type).toBe(RootLayout);
    expect(asElement(root.props.children).type).toBe(RouteOutlet);
    expect(pageContent(pageNode).type).toBe(pageComponent(HomePage));
    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toEqual(["/"]);
    expect(Object.getOwnPropertyDescriptor(App, "routes")).toMatchObject({
      configurable: false,
      writable: false,
    });
    expect(Object.isExtensible(App)).toBe(true);
  });

  it("renders a dynamic route pattern with its concrete pathname and captured params", () => {
    const DayPage = EFFRONT.Page.make({
      params: Schema.Struct({ day: Schema.Literals(["saturday", "sunday"]) }),
      render: ({ params }) => Effect.succeed(<h1>{params.day}</h1>),
    });
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/schedule/:day", DayPage),
    });
    const saturdayPage = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/schedule/:day", "/schedule/saturday", {
        day: "saturday",
      }),
    );
    const sundayPage = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/schedule/:day", "/schedule/sunday", {
        day: "sunday",
      }),
    );
    const saturdayElement = pageContent(saturdayPage);

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toEqual(["/schedule/:day"]);
    expect(saturdayPage.id).not.toBe(sundayPage.id);
    expect(saturdayElement.type).toBe(pageComponent(DayPage));
    expect(saturdayElement.props.params).toEqual({ _tag: "Encoded", value: { day: "saturday" } });
  });

  it("preserves Layout ancestry and places Loading below its owning Layout", () => {
    const scheduleRoutes = EFFRONT.Routes.make({
      layout: ScheduleLayout,
      loading: ScheduleLoading,
    })
      .page("/", SaturdayPage)
      .page("/day-two", SundayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/schedule", scheduleRoutes),
    });
    const sundayRootNode = renderApplicationRoute(applicationRoutes(App), "/schedule/day-two");
    const saturdayRootNode = renderApplicationRoute(applicationRoutes(App), "/schedule");
    const scheduleLayoutNode = requiredChild(sundayRootNode);
    const saturdayScheduleLayoutNode = requiredChild(saturdayRootNode);
    const loadingNode = requiredChild(scheduleLayoutNode);
    const saturdayLoadingNode = requiredChild(saturdayScheduleLayoutNode);
    const pageNode = requiredChild(loadingNode);
    const loadingBoundary = asElement<{
      readonly children: ReactNode;
      readonly fallback: ReactNode;
    }>(loadingNode.content);

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toEqual([
      "/",
      "/schedule",
      "/schedule/day-two",
    ]);
    expect(asElement(sundayRootNode.content).type).toBe(RootLayout);
    expect(scheduleLayoutNode.id).toBe(saturdayScheduleLayoutNode.id);
    expect(asElement(scheduleLayoutNode.content).type).toBe(ScheduleLayout);
    expect(loadingNode.id).not.toBe(saturdayLoadingNode.id);
    expect(loadingBoundary.type).toBe(Suspense);
    expect(asElement(loadingBoundary.props.fallback).type).toBe(ScheduleLoading);
    expect(asElement(loadingBoundary.props.children).type).toBe(RouteOutlet);
    expect(pageNode.id).not.toBe(loadingNode.id);
    expect(pageContent(pageNode).type).toBe(pageComponent(SundayPage));
  });

  it("lets layoutless Routes group paths without adding a rendered node", () => {
    const groupedRoutes = EFFRONT.Routes.make()
      .page("/", SaturdayPage)
      .page("/day-two", SundayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).mount("/schedule", groupedRoutes),
    });
    const rootNode = renderApplicationRoute(applicationRoutes(App), "/schedule/day-two");
    const pageNode = requiredChild(rootNode);

    expect(pageContent(pageNode).type).toBe(pageComponent(SundayPage));
  });

  it("supports a Loading scope without requiring a nested Layout", () => {
    const groupedRoutes = EFFRONT.Routes.make({ loading: ScheduleLoading }).page("/", SaturdayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout }).mount("/schedule", groupedRoutes),
    });
    const rootNode = renderApplicationRoute(applicationRoutes(App), "/schedule");
    const loadingNode = requiredChild(rootNode);
    const pageNode = requiredChild(loadingNode);

    expect(asElement(loadingNode.content).type).toBe(Suspense);
    expect(pageContent(pageNode).type).toBe(pageComponent(SaturdayPage));
  });

  it("compiles one Routes value mounted at more than one prefix", () => {
    const sharedRoutes = EFFRONT.Routes.make({ layout: ScheduleLayout })
      .page("/", SaturdayPage)
      .page("/day-two", SundayPage);
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/saturday", sharedRoutes)
        .mount("/sunday", sharedRoutes),
    });
    const saturdayLayoutNode = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/saturday/day-two"),
    );
    const sundayLayoutNode = requiredChild(
      renderApplicationRoute(applicationRoutes(App), "/sunday/day-two"),
    );

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toEqual([
      "/",
      "/saturday",
      "/saturday/day-two",
      "/sunday",
      "/sunday/day-two",
    ]);
    expect(saturdayLayoutNode.id).not.toBe(sundayLayoutNode.id);
    expect(requiredChild(saturdayLayoutNode).id).not.toBe(requiredChild(sundayLayoutNode).id);
  });

  it("compiles Pages into matcher-neutral destinations", () => {
    const App = EFFRONT.make({
      routes: EFFRONT.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/schedule", EFFRONT.Routes.make().page("/", SaturdayPage)),
    });

    expect(applicationRoutes(App).map(({ pattern }) => pattern)).toEqual(["/", "/schedule"]);
    expect(applicationRoutes(App)[0]?.page.component).toBe(pageComponent(HomePage));
    expect(applicationRoutes(App)[1]?.page.component).toBe(pageComponent(SaturdayPage));
  });

  it("compiles inherited middleware without adding React scopes", () => {
    const RootMiddleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const NestedMiddleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const RootScope = EFFRONT.withMiddleware(RootMiddleware);
    const NestedScope = RootScope.withMiddleware(NestedMiddleware);
    const App = EFFRONT.make({
      routes: RootScope.Routes.make({ layout: RootLayout })
        .page("/", HomePage)
        .mount("/schedule", NestedScope.Routes.make().page("/", SaturdayPage)),
    });
    const [home, schedule] = applicationRoutes(App);

    expect(home?.middleware).toEqual([RootMiddleware]);
    expect(schedule?.middleware).toEqual([RootMiddleware, NestedMiddleware]);
    expect(schedule?.scopes).toHaveLength(1);
    expect(Object.isFrozen(schedule?.middleware)).toBe(true);
  });

  it("does not duplicate inherited middleware across nested scopes", () => {
    const RequireUser = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const Authenticated = EFFRONT.withMiddleware(RequireUser);
    const routes = Authenticated.Routes.make({ layout: RootLayout }).mount(
      "/account",
      Authenticated.Routes.make().page("/", HomePage),
    );
    const App = EFFRONT.make({ routes });

    expect(applicationRoutes(App)[0]?.middleware).toEqual([RequireUser]);
  });

  it("rejects repeated middleware in a divergent mounted scope without Pages", () => {
    const Shared = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const NestedOnly = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const ParentEFFRONT = EFFRONT.withMiddleware(Shared);
    const DivergentEFFRONT = EFFRONT.withMiddleware(NestedOnly).withMiddleware(Shared);
    const leafRoutes = EFFRONT.Routes.make().page("/", HomePage);
    const divergentRoutes = DivergentEFFRONT.Routes.make().mount("/leaf", leafRoutes);
    const routes = ParentEFFRONT.Routes.make({ layout: RootLayout }).mount(
      "/nested",
      divergentRoutes,
    );

    expect(() => EFFRONT.make({ routes })).toThrow(
      new TypeError(
        'Middleware beneath route prefix "/nested" appears more than once in its resolved chain.',
      ),
    );
  });

  it("allocates route scope IDs across derived EFFRONT views", () => {
    const Middleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const ScopedEFFRONT = EFFRONT.withMiddleware(Middleware);
    const rootRoutes = EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage);
    const scopedRoutes = ScopedEFFRONT.Routes.make({ layout: ScheduleLayout }).page(
      "/",
      SaturdayPage,
    );

    expect(getRoutesState(rootRoutes).scopeId).not.toBe(getRoutesState(scopedRoutes).scopeId);
  });

  it("declares service contracts once and chooses their implementations at application assembly", () => {
    type AppServices = LayoutService | PageService | NestedPageService;
    const ServiceEFFRONT = Application.effront<AppServices>();
    const ServiceLayout = ServiceEFFRONT.Layout.make({
      render: Effect.fn(function* ({ children }) {
        yield* LayoutService;
        return <>{children}</>;
      }),
    });
    const ServicePage = ServiceEFFRONT.Page.make({
      render: Effect.fn(function* () {
        yield* PageService;
        return <h1>Home</h1>;
      }),
    });
    const ServiceNestedPage = ServiceEFFRONT.Page.make({
      render: Effect.fn(function* () {
        yield* NestedPageService;
        return <h1>Nested</h1>;
      }),
    });
    const ApplicationLayer = Layer.mergeAll(
      Layer.succeed(LayoutService, LayoutService.of({})),
      Layer.succeed(PageService, PageService.of({})),
      Layer.succeed(NestedPageService, NestedPageService.of({})),
    );
    const App = ServiceEFFRONT.make({
      routes: ServiceEFFRONT.Routes.make({ layout: ServiceLayout })
        .page("/", ServicePage)
        .mount("/nested", ServiceEFFRONT.Routes.make().page("/", ServiceNestedPage)),
      layer: ApplicationLayer,
    });
    expect(getApplicationState(App).layer).toBe(ApplicationLayer);
  });

  it("requires a root Layout and a reachable Page at runtime", () => {
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for a root without a Layout.
        routes: EFFRONT.Routes.make().page("/", HomePage),
      }),
    ).toThrow("must define a Layout");
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for a root without a Page.
        routes: EFFRONT.Routes.make({ layout: RootLayout }),
      }),
    ).toThrow("must contain a Page");
  });

  it("rejects route concerns created by a different EFFRONT module", () => {
    const OtherEFFRONT = Application.effront();
    const OtherLayout = OtherEFFRONT.Layout.make({
      render: ({ children }) => Effect.succeed(children),
    });
    const OtherLoading = OtherEFFRONT.Loading.make({ render: () => <p>Loading...</p> });
    const OtherPage = OtherEFFRONT.Page.make({ render: () => Effect.succeed(<h1>Other</h1>) });
    const OtherMiddleware = OtherEFFRONT.Middleware.make((httpEffect) => httpEffect);
    const OtherRoutes = OtherEFFRONT.Routes.make({ layout: OtherLayout }).page("/", OtherPage);

    expect(() => EFFRONT.Routes.make({ layout: OtherLayout })).toThrow(
      "Layout was created by a different EFFRONT module.",
    );
    expect(() => EFFRONT.Routes.make({ loading: OtherLoading })).toThrow(
      "Loading was created by a different EFFRONT module.",
    );
    expect(() => EFFRONT.withMiddleware(OtherMiddleware)).toThrow(
      "Middleware was created by a different EFFRONT module.",
    );
    expect(() =>
      EFFRONT.make({
        routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", OtherPage),
      }),
    ).toThrow("created by a different EFFRONT module");
    expect(() => EFFRONT.make({ routes: OtherRoutes })).toThrow(
      "Root Routes were created by a different EFFRONT module.",
    );
    expect(() => EFFRONT.Routes.make().mount("/other", OtherRoutes)).toThrow(
      'Routes mounted at "/other" were created by a different EFFRONT module.',
    );
  });

  it("rejects same-EFFRONT members used as the wrong route concern", () => {
    const Leaf = EFFRONT.Component.make({ render: () => Effect.succeed(<p>Leaf</p>) });

    expect(() =>
      EFFRONT.Routes.make({
        // @ts-expect-error Loading is not a Layout concern.
        layout: ScheduleLoading,
      }),
    ).toThrow("Layout must be created with EFFRONT.Layout.make.");
    expect(() =>
      EFFRONT.Routes.make({
        // @ts-expect-error Layout is not a Loading concern.
        loading: RootLayout,
      }),
    ).toThrow("Loading must be created with EFFRONT.Loading.make.");
    expect(() =>
      EFFRONT.Routes.make().page(
        "/",
        // @ts-expect-error Component is not a Page concern.
        Leaf,
      ),
    ).toThrow("Page must be created with EFFRONT.Page.make.");
  });
});
