import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema, SchemaTransformation } from "effect";

import { Application } from "./effront";
import { getRoutesState } from "./routes";
import { analyzeRoutePath, type ValidRoutePath } from "./route-path";

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
    ).toThrow('cannot contain "?", "#", "%", ";", or "\\"');
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

describe("named catch-all routes", () => {
  const PathPage = EFFRONT.Page.make({
    params: Schema.Struct({ path: Schema.String }),
    render: ({ params }) => Effect.succeed(<h1>{params.path}</h1>),
  });

  it("infers the terminal capture and mounts beneath a static prefix", () => {
    const child = EFFRONT.Routes.make().page("/*path", PathPage);
    const routes = EFFRONT.Routes.make({ layout: Shell }).mount("/manual", child);
    expect(getRoutesState(routes).paths).toEqual(["/manual/*path"]);
    expect(() => EFFRONT.make({ routes })).not.toThrow();
    expect(analyzeRoutePath("/manual/*path")).toMatchObject({
      catchAll: "path",
      matcher: "/manual/*",
      shapes: ["/manual/*", "/manual"],
      parameterNames: ["path"],
    });
    const nested = EFFRONT.Routes.make().page("/a/:b/*d", NestedParamsPage);
    expect(getRoutesState(nested).paths).toEqual(["/a/:b/*d"]);
  });

  it("requires the catch-all schema key and keeps static mount constraints", () => {
    expect(() =>
      // @ts-expect-error A catch-all Page requires a parameter Schema.
      EFFRONT.Routes.make().page("/manual/*path", HomePage),
    ).toThrow("must declare a parameter Schema");
    const checkNames = () => {
      // @ts-expect-error The schema must declare path, not slug.
      EFFRONT.Routes.make().page("/manual/*path", SlugPage);
      // @ts-expect-error Both regular and catch-all parameters must appear in the Schema.
      EFFRONT.Routes.make().page("/manual/:slug/*path", PathPage);
    };
    expect(checkNames).toBeTypeOf("function");
    expect(() =>
      // @ts-expect-error Catch-all mount prefixes are parameterized, not static.
      EFFRONT.Routes.make().mount("/manual/*path", EFFRONT.Routes.make().page("/", HomePage)),
    ).toThrow("cannot be mounted beneath parameterized path");
  });

  it("rejects malformed wildcards at both grammar boundaries", () => {
    // This list is also a compile-time assertion: none of these literals may be ValidRoutePath.
    type Invalid =
      | "/manual/*"
      | "/manual/*path/more"
      | "/manual/prefix*path"
      | "/manual/**path"
      | "/manual/*bad-name"
      | "/manual/:path/*path";
    const invalid: ReadonlyArray<Invalid> = [
      "/manual/*",
      "/manual/*path/more",
      "/manual/prefix*path",
      "/manual/**path",
      "/manual/*bad-name",
      "/manual/:path/*path",
    ];
    type Accepted = { [Path in Invalid]: ValidRoutePath<Path> }[Invalid];
    const assertInvalid = (path: Accepted) => path;
    for (const path of invalid) {
      // @ts-expect-error None of the malformed patterns is a valid route path.
      assertInvalid(path);
      expect(() => analyzeRoutePath(path)).toThrow(TypeError);
    }
  });

  it("rejects renamed wildcard duplicates and collisions with the empty-capture prefix", () => {
    const child = EFFRONT.Routes.make().page("/*path", PathPage);
    expect(() =>
      // @ts-expect-error Unmounted child catch-alls also reserve their empty prefix.
      child.page("/", HomePage),
    ).toThrow("conflicts with an existing route pattern");
    const routes = EFFRONT.Routes.make().page("/Manual/*path", PathPage);
    expect(() =>
      // @ts-expect-error Wildcard names do not distinguish route shapes.
      routes.page("/manual/*slug", SlugPage),
    ).toThrow("conflicts with an existing route pattern");
    expect(() =>
      // @ts-expect-error The catch-all already owns its empty-capture prefix.
      routes.page("/manual", HomePage),
    ).toThrow("conflicts with an existing route pattern");
    expect(() =>
      // @ts-expect-error Adding the catch-all after its root also conflicts.
      EFFRONT.Routes.make().page("/manual", HomePage).page("/manual/*path", PathPage),
    ).toThrow("conflicts with an existing route pattern");
    expect(() =>
      EFFRONT.Routes.make()
        .page("/manual", HomePage)
        // @ts-expect-error Mounts must account for the wildcard's implicit root route.
        .mount("/manual", EFFRONT.Routes.make().page("/*path", PathPage)),
    ).toThrow("conflicts with an existing route pattern");
    expect(() =>
      routes.page("/manual/about", HomePage).page("/manual/:slug", SlugPage),
    ).not.toThrow();
  });

  it("rejects catch-alls overlapping the reserved framework namespace", () => {
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Root catch-alls overlap the reserved namespace.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/*path", PathPage),
      }),
    ).toThrow("framework-reserved");
    expect(() =>
      EFFRONT.make({
        // @ts-expect-error Named catch-alls beneath the framework namespace are reserved.
        routes: EFFRONT.Routes.make({ layout: Shell }).page("/_EFFRONT/*path", PathPage),
      }),
    ).toThrow("framework-reserved");
  });
});
