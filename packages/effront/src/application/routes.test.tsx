import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Schema, SchemaTransformation } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { Application } from "../index";
import { createFetchHandler } from "../workers";
import { getRoutesState } from "./routes";

const EFFRONT = Application.effront();
const Shell = EFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(<main>{children}</main>),
});

const LoadingPage = EFFRONT.Loading.make({ render: () => <p>Loading...</p> });
const HomePage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>Home</h1>) });
const HistoryPage = EFFRONT.Page.make({ render: () => Effect.succeed(<h1>History</h1>) });
const DayPage = EFFRONT.Page.make({
  params: Schema.Struct({ day: Schema.Literals(["saturday", "sunday"]) }),
  render: ({ params }) => Effect.succeed(<h1>{params.day}</h1>),
});
const SlugPage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.String }),
  render: ({ params }) => Effect.succeed(<h1>{params.slug}</h1>),
});
const NestedParamsPage = EFFRONT.Page.make({
  params: Schema.Struct({ b: Schema.String, d: Schema.String }),
  render: ({ params }) =>
    Effect.succeed(
      <h1>
        {params.b}/{params.d}
      </h1>,
    ),
});
const RenamedParamsPage = EFFRONT.Page.make({
  params: Schema.Struct({ slug: Schema.String }).pipe(
    Schema.decodeTo(
      Schema.Struct({ id: Schema.String }),
      SchemaTransformation.transform({
        decode: ({ slug }) => ({ id: slug }),
        encode: ({ id }) => ({ slug: id }),
      }),
    ),
  ),
  render: ({ params }) => Effect.succeed(<h1>{params.id}</h1>),
});

describe("Routes", () => {
  it("captures immutable middleware scopes from a derived EFFRONT view", () => {
    const First = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const Second = EFFRONT.Middleware.make((httpEffect) => httpEffect);
    const FirstScope = EFFRONT.withMiddleware(First);
    const SecondScope = FirstScope.withMiddleware(Second);
    const routes = SecondScope.Routes.make();
    expect(getRoutesState(routes).middleware).toEqual([First, Second]);
    expect(Object.isFrozen(First)).toBe(true);
    expect(Object.isFrozen(getRoutesState(routes).middleware)).toBe(true);
    expect(() => FirstScope.withMiddleware(First)).toThrow("cannot appear twice in the same scope");
    const OtherEFFRONT = Application.effront();
    const OtherMiddleware = OtherEFFRONT.Middleware.make((httpEffect) => httpEffect);
    expect(() => EFFRONT.withMiddleware(OtherMiddleware)).toThrow(
      "created by a different EFFRONT module",
    );
  });

  it("composes immutable mountable route descriptions", () => {
    const empty = EFFRONT.Routes.make({ layout: Shell, loading: LoadingPage });
    const notesRoutes = EFFRONT.Routes.make().page("/", HomePage).page("/history", HistoryPage);
    const routes = empty.mount("/notes", notesRoutes);
    expect(getRoutesState(empty).paths).toEqual([]);
    expect(getRoutesState(notesRoutes).paths).toEqual(["/", "/history"]);
    expect(getRoutesState(routes).paths).toEqual(["/notes", "/notes/history"]);
    expect(Object.isFrozen(routes)).toBe(true);
    expect(Object.isFrozen(getRoutesState(routes).paths)).toBe(true);
    expect(Object.isFrozen(getRoutesState(notesRoutes).pages[0])).toBe(true);
    expect(Object.isFrozen(getRoutesState(routes).mounts[0])).toBe(true);
  });

  it("infers dynamic path params from Page schemas", () => {
    const routes = EFFRONT.Routes.make().page("/schedule/:day", DayPage);
    expect(getRoutesState(routes).paths).toEqual(["/schedule/:day"]);
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a parameter-free Page.
      EFFRONT.Routes.make().page("/schedule/:day", HomePage),
    ).toThrow("must declare a parameter Schema");
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a parameterized Page.
      EFFRONT.Routes.make().page("/schedule/saturday", DayPage),
    ).toThrow("requires route parameters");
  });

  it("infers every parameter across a nested route pattern", () => {
    const routes = EFFRONT.Routes.make().page("/a/:b/c/:d", NestedParamsPage);
    expect(getRoutesState(routes).paths).toEqual(["/a/:b/c/:d"]);
  });

  it("matches route names against the encoded Schema while rendering its decoded type", () => {
    const routes = EFFRONT.Routes.make().page("/:slug", RenamedParamsPage);
    expect(getRoutesState(routes).paths).toEqual(["/:slug"]);
  });

  it("requires a finite, non-empty Schema of string-encoded path parameters", () => {
    const unknownInputPage = EFFRONT.Page.make({
      params: Schema.Struct({ value: Schema.Unknown }),
      render: ({ params }) => Effect.succeed(<h1>{typeof params.value}</h1>),
    });
    const routes = EFFRONT.Routes.make().page("/:value", unknownInputPage);
    expect(getRoutesState(routes).paths).toEqual(["/:value"]);
  });

  it("rejects invalid and reserved route paths at the type and runtime boundaries", () => {
    expect(() =>
      // @ts-expect-error Exercise runtime validation for malformed dynamic syntax.
      EFFRONT.Routes.make().page("/users/user:userId", HomePage),
    ).toThrow('Dynamic segments must use the ":parameter" convention');
    expect(() =>
      // @ts-expect-error Exercise canonical-path runtime validation.
      EFFRONT.Routes.make().page("/users/", HomePage),
    ).toThrow('cannot contain empty, ".", or ".." segments or end with "/"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for empty segments.
      EFFRONT.Routes.make().page("/users//history", HomePage),
    ).toThrow('cannot contain empty, ".", or ".." segments or end with "/"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for URL-normalized dot segments.
      EFFRONT.Routes.make().page("/users/../history", HomePage),
    ).toThrow('cannot contain empty, ".", or ".." segments or end with "/"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for percent escapes.
      EFFRONT.Routes.make().page("/users/%61", HomePage),
    ).toThrow('cannot contain "*", "?", "#", "%", ";", or "\\"');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for duplicate parameter names.
      EFFRONT.Routes.make().page("/users/:userId/:userId", HomePage),
    ).toThrow("Dynamic parameter names must be unique within a route");
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a dynamic mount prefix.
      EFFRONT.Routes.make().mount("/:group", EFFRONT.Routes.make().page("/", HomePage)),
    ).toThrow('Routes cannot be mounted beneath parameterized path "/:group".');
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for the reserved framework namespace.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/_effront/dev", HomePage),
      }),
    ).toThrow('uses the framework-reserved "/_effront" namespace');
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise overlap detection for a parameterized framework route.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/:slug/dev", SlugPage),
      }),
    ).toThrow('uses the framework-reserved "/_effront" namespace');
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Exercise runtime validation for the namespace root.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/_effront", HomePage),
      }),
    ).toThrow('uses the framework-reserved "/_effront" namespace');
  });

  it("rejects duplicate paths introduced locally or by a mount", () => {
    const homeRoutes = EFFRONT.Routes.make().page("/", HomePage);
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a duplicate local path.
      homeRoutes.page("/", HistoryPage),
    ).toThrow('Route "/" conflicts with an existing route pattern.');
    expect(() =>
      // @ts-expect-error Exercise runtime validation for a duplicate mounted path.
      homeRoutes.mount("/", EFFRONT.Routes.make().page("/", HistoryPage)),
    ).toThrow('Route "/" conflicts with an existing route pattern.');

    const dynamicRoutes = EFFRONT.Routes.make().page("/:day", DayPage);
    expect(() =>
      // @ts-expect-error Renaming a parameter does not create a distinct route pattern.
      dynamicRoutes.page("/:slug", SlugPage),
    ).toThrow('Route "/:slug" conflicts with an existing route pattern.');

    const caseInsensitiveRoutes = EFFRONT.Routes.make().page("/Schedule", HomePage);
    expect(() =>
      // @ts-expect-error Effect HTTP matches static path segments case-insensitively.
      caseInsensitiveRoutes.page("/schedule", HistoryPage),
    ).toThrow('Route "/schedule" conflicts with an existing route pattern.');
  });

  it("rejects mounting Routes that contain no pages", () => {
    const emptyRoutes = EFFRONT.Routes.make({ layout: Shell });
    expect(() =>
      // @ts-expect-error Exercise runtime validation for an empty mounted route collection.
      EFFRONT.Routes.make().mount("/empty", emptyRoutes),
    ).toThrow('Cannot mount empty Routes at "/empty".');
  });
});

describe("Routes.fromPages", () => {
  it("registers wide readonly entries as non-empty root routes without assertions", () => {
    const paths: ReadonlyArray<string> = ["/", "/guides/nested/history"];
    const entries = paths.map((path): readonly [string, typeof HomePage] => [path, HomePage]);
    const routes = EFFRONT.Routes.fromPages(entries, { layout: Shell, loading: LoadingPage });
    expect(() => EFFRONT.make({ routes })).not.toThrow();
    expect(getRoutesState(routes).paths).toEqual(paths);
  });

  it("mounts runtime entries and permits subsequent literal registrations", () => {
    const child = EFFRONT.Routes.fromPages([["/deep/nested", HomePage]]);
    const routes = EFFRONT.Routes.make({ layout: Shell }).mount("/docs", child).page("/", HomePage);
    expect(() => EFFRONT.make({ routes })).not.toThrow();
    expect(getRoutesState(routes).paths).toEqual(["/docs/deep/nested", "/"]);
  });

  it("copies mutable entry arrays into an immutable route collection", () => {
    const entry: [string, typeof HomePage] = ["/original", HomePage];
    const entries = [entry];
    const routes = EFFRONT.Routes.fromPages(entries);
    entry[0] = "/changed";
    entries.push(["/added", HistoryPage]);
    expect(getRoutesState(routes).paths).toEqual(["/original"]);
    expect(Object.isFrozen(getRoutesState(routes).pages)).toBe(true);
    expect(Object.isFrozen(getRoutesState(routes).pages[0])).toBe(true);
  });

  it("rejects empty collections before claiming non-empty routes", () => {
    expect(() => EFFRONT.Routes.fromPages([])).toThrow(TypeError);
  });

  it.each([
    "relative",
    "/trailing/",
    "/empty//segment",
    "/dot/../segment",
    "/dot/./segment",
    "/escaped/%E6%97%A5",
    "/literal%",
    "/wildcard/*",
    "/query?value",
    "/fragment#value",
    "/semi;colon",
    "/back\\slash",
    "/:parameter",
    "/embedded:parameter",
  ])("rejects unsupported static path %s", (path) => {
    expect(() => EFFRONT.Routes.fromPages([[path, HomePage]])).toThrow(TypeError);
  });

  it("rejects a parameterized Page at compile time and runtime", () => {
    expect(() =>
      // @ts-expect-error Static entry collections cannot register parameterized pages.
      EFFRONT.Routes.fromPages([["/day", DayPage]]),
    ).toThrow(TypeError);
  });

  it("rejects case-insensitive duplicate entries", () => {
    expect(() =>
      EFFRONT.Routes.fromPages([
        ["/Guide", HomePage],
        ["/guide", HistoryPage],
      ]),
    ).toThrow(TypeError);
  });

  it("checks runtime collection collisions against existing literal routes", () => {
    const child = EFFRONT.Routes.fromPages([["/guide", HomePage]]);
    expect(() =>
      EFFRONT.Routes.make().page("/docs/guide", HistoryPage).mount("/docs", child),
    ).toThrow(TypeError);
  });

  it("checks subsequent additions against the runtime collection", () => {
    const routes = EFFRONT.Routes.fromPages([["/guide", HomePage]]);
    expect(() =>
      // @ts-expect-error An opaque runtime path set cannot prove literal additions collision-free.
      routes.page("/guide", HistoryPage),
    ).toThrow(TypeError);
  });

  it("rejects another module's Page even with identical service types", () => {
    const Other = Application.effront();
    const page = Other.Page.make({ render: () => Effect.succeed(<h1>Other</h1>) });
    expect(() => EFFRONT.Routes.fromPages([["/", page]])).toThrow(TypeError);
  });

  it("requires the root layout at compile time and runtime", () => {
    const routes = EFFRONT.Routes.fromPages([["/", HomePage]]);
    expect(() =>
      // @ts-expect-error A non-empty collection still needs a root Layout.
      EFFRONT.make({ routes }),
    ).toThrow(TypeError);
  });

  it("rejects reserved root namespaces when compiling enumerated routes", () => {
    const routes = EFFRONT.Routes.fromPages([["/_effront/assets/secret", HomePage]], {
      layout: Shell,
    });
    expect(() => EFFRONT.make({ routes })).toThrow(TypeError);
  });

  it("does not erase application service requirements", () => {
    class Greeting extends Context.Service<Greeting, string>()("effront/tests/routes/Greeting") {}
    const Other = Application.effront<Greeting>();
    const page = Other.Page.make({
      render: () => Effect.map(Greeting, (value) => <h1>{value}</h1>),
    });
    const layout = Other.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const routes = Other.Routes.fromPages([["/", page]], { layout });
    expect(() => Other.make({ routes, layer: Layer.succeed(Greeting, "Hello") })).not.toThrow();
    expect(() =>
      // @ts-expect-error A Page from a module with services cannot enter a service-free module.
      EFFRONT.Routes.fromPages([["/", page]]),
    ).toThrow(TypeError);
    // Compile-only checks must not create an application with missing services at runtime.
    const checkRequiredLayer = () => {
      // @ts-expect-error Runtime-enumerated routes retain the module's required application Layer.
      Other.make({ routes });
    };
    expect(checkRequiredLayer).toBeTypeOf("function");
  });

  it.each([
    ["/guides/deeply/nested/page", "/guides/deeply/nested/page"],
    ["/日本語/入門", "/%E6%97%A5%E6%9C%AC%E8%AA%9E/%E5%85%A5%E9%96%80"],
    ["/guide/with spaces", "/guide/with%20spaces"],
    ["/guide/punctuation!()'", "/guide/punctuation!()'"],
    ["/guide/$&+,=@", "/guide/$&+,=@"],
  ])("matches the real Fetch request for %s", async (path, url) => {
    const App = Application.effront();
    const Respond = App.Middleware.make(() =>
      Effect.map(HttpRouter.RouteContext, ({ route }) => HttpServerResponse.text(route.path)),
    );
    const layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const page = App.Page.make({ render: () => Effect.die("Route middleware must respond.") });
    const routes = App.withMiddleware(Respond).Routes.fromPages([[path, page]], { layout });
    const handler = createFetchHandler(App.make({ routes }));
    const response = await handler(new Request(`https://routes.test${url}`), {}, {});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(path);
  });

  it("returns 404 for an unregistered descendant rather than matching a wildcard", async () => {
    const App = Application.effront();
    const Respond = App.Middleware.make(() => Effect.succeed(HttpServerResponse.text("matched")));
    const layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const page = App.Page.make({ render: () => Effect.die("Route middleware must respond.") });
    const routes = App.withMiddleware(Respond).Routes.fromPages([["/guide", page]], { layout });
    const handler = createFetchHandler(App.make({ routes }));
    const response = await handler(new Request("https://routes.test/guide/unregistered"), {}, {});
    expect(response.status).toBe(404);
    await response.body?.cancel();
  });
});
