import { Context, Effect, Layer, Option, Schema, SchemaTransformation } from "effect";
import type { ReactNode } from "react";

import type { ApplicationServices } from "../../src/application/definition";
import { Application } from "../../src/application/effront";
import type { AnyPageDefinition } from "../../src/application/page";
import type { AbsolutePath } from "../../src/application/route-path";
import type { AnyRoutes, RoutesDefinition, RoutesPaths } from "../../src/application/routes";

class LayoutService extends Context.Service<LayoutService, object>()(
  "effront/tests/types/LayoutService",
) {}
class PageService extends Context.Service<PageService, object>()(
  "effront/tests/types/PageService",
) {}
class NestedPageService extends Context.Service<NestedPageService, object>()(
  "effront/tests/types/NestedPageService",
) {}
class LayerDependency extends Context.Service<LayerDependency, object>()(
  "effront/tests/types/LayerDependency",
) {}

const EFFRONT = Application.effront();
const RootLayout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
EFFRONT.Layout.make({
  render: ({ children }) => {
    const inferredChildren: ReactNode = children;
    const childrenAreNotAny: 0 extends 1 & typeof children ? false : true = true;
    void childrenAreNotAny;
    return Effect.succeed(inferredChildren);
  },
});
const Loading = EFFRONT.Loading.make({ render: () => <p>Loading...</p> });
void Loading;
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
  render: ({ params }) => Effect.succeed(`${params.b}/${params.d}`),
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
  render: ({ params }) => Effect.succeed(params.id),
});

const middleware = EFFRONT.Middleware.make((httpEffect) => httpEffect);
EFFRONT.withMiddleware(middleware).Routes.make();
EFFRONT.Middleware.make(
  // @ts-expect-error Middleware must handle every typed failure it introduces.
  // intentional invalid Effect fixture
  (httpEffect) => Effect.andThen(Effect.fail("failure"), httpEffect),
);

const notesRoutes = EFFRONT.Routes.make().page("/", HomePage).page("/history", HistoryPage);
const mountedRoutes = EFFRONT.Routes.make().mount("/notes", notesRoutes);
const knownNotesPath: RoutesPaths<typeof mountedRoutes> = "/notes/history";
void knownNotesPath;
// @ts-expect-error Runtime paths are private to the route compiler.
void mountedRoutes.paths;
// @ts-expect-error Runtime pages are private to the route compiler.
void mountedRoutes.pages;
// @ts-expect-error Runtime mounts are private to the route compiler.
void mountedRoutes.mounts;

const dynamicRoutes = EFFRONT.Routes.make().page("/schedule/:day", DayPage);
const knownDynamicPath: RoutesPaths<typeof dynamicRoutes> = "/schedule/:day";
void knownDynamicPath;
// @ts-expect-error A static Page cannot satisfy a dynamic route.
EFFRONT.Routes.make().page("/schedule/:day", HomePage);
// @ts-expect-error A dynamic Page cannot satisfy a static route.
EFFRONT.Routes.make().page("/schedule/saturday", DayPage);
// @ts-expect-error The Page Schema key must match the path parameter name.
EFFRONT.Routes.make().page("/schedule/:day", SlugPage);
// @ts-expect-error Page implementation details are not part of the authoring API.
void DayPage.component;

const nestedRoutes = EFFRONT.Routes.make().page("/a/:b/c/:d", NestedParamsPage);
const knownNestedPath: RoutesPaths<typeof nestedRoutes> = "/a/:b/c/:d";
void knownNestedPath;
// @ts-expect-error The Page Schema must contain both nested parameter names.
EFFRONT.Routes.make().page("/a/:b/c/:d", DayPage);
// @ts-expect-error Parameter names must remain unique across the complete pattern.
EFFRONT.Routes.make().page("/a/:b/c/:b", NestedParamsPage);
// @ts-expect-error Route parameters describe the Schema input, not its decoded output.
EFFRONT.Routes.make().page("/:id", RenamedParamsPage);

declare const uncertainPath: "/first" | "/second";
const widenedPath: AbsolutePath = "/schedule/:day";
const forgetPageContract = (page: AnyPageDefinition<never>) => page;
const widenedPage = forgetPageContract(HomePage);
const widenedRoutes: AnyRoutes<never> = EFFRONT.Routes.make().page("/", HomePage);
// @ts-expect-error A widened path cannot provide exact parameter inference.
EFFRONT.Routes.make().page(widenedPath, HomePage);
// @ts-expect-error One route declaration must have one literal pattern.
EFFRONT.Routes.make().page(uncertainPath, HomePage);
// @ts-expect-error A widened Page no longer proves whether it owns parameters.
EFFRONT.Routes.make().page("/", widenedPage);
// @ts-expect-error Widened Routes no longer carry their exact mounted paths.
EFFRONT.Routes.make().mount("/nested", widenedRoutes);

// @ts-expect-error An empty parameter Schema cannot match a parameterized path.
EFFRONT.Page.make({ params: Schema.Struct({}), render: () => Effect.succeed(null) });
const recordParamsPageOptions = {
  params: Schema.Record(Schema.String, Schema.String),
  render: () => Effect.succeed(null),
};
// @ts-expect-error A record Schema has no finite parameter-name set.
EFFRONT.Page.make(recordParamsPageOptions);
const nonStringParamsPageOptions = {
  params: Schema.Struct({ count: Schema.Finite }),
  render: () => Effect.succeed(null),
};
// @ts-expect-error Effect HTTP captures path parameters as strings.
EFFRONT.Page.make(nonStringParamsPageOptions);
const invalidNameParamsPageOptions = {
  params: Schema.Struct({ "invalid-name": Schema.String }),
  render: () => Effect.succeed(null),
};
// @ts-expect-error Schema keys must be valid Effect HTTP parameter names.
EFFRONT.Page.make(invalidNameParamsPageOptions);

// @ts-expect-error Dynamic params must occupy a complete path segment.
EFFRONT.Routes.make().page("/users/user:userId", HomePage);
// @ts-expect-error Dynamic parameter names must be unique.
EFFRONT.Routes.make().page("/users/:userId/:userId", HomePage);
// @ts-expect-error Route definitions must use canonical non-trailing slashes.
EFFRONT.Routes.make().page("/users/", HomePage);
// @ts-expect-error Route definitions cannot contain empty segments.
EFFRONT.Routes.make().page("/users//history", HomePage);
// @ts-expect-error Route definitions cannot contain URL-normalized dot segments.
EFFRONT.Routes.make().page("/users/../history", HomePage);
// @ts-expect-error Route definitions use decoded path text, not percent escapes.
EFFRONT.Routes.make().page("/users/%61", HomePage);
// @ts-expect-error Dynamic mount prefixes are not supported.
EFFRONT.Routes.make().mount("/:group", EFFRONT.Routes.make().page("/", HomePage));
EFFRONT.make({
  // @ts-expect-error The final application path uses the framework namespace.
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/_effront/dev", HomePage),
});
EFFRONT.make({
  // @ts-expect-error A parameterized pattern can match the framework namespace.
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/:slug/dev", SlugPage),
});
EFFRONT.make({
  // @ts-expect-error The framework namespace root is reserved.
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/_effront", HomePage),
});

const homeRoutes = EFFRONT.Routes.make().page("/", HomePage);
// @ts-expect-error A local Page cannot replace an existing Page.
homeRoutes.page("/", HistoryPage);
// @ts-expect-error Mounted paths cannot collide with existing paths.
homeRoutes.mount("/", EFFRONT.Routes.make().page("/", HistoryPage));

const scheduleRoutes = EFFRONT.Routes.make().page("/", HomePage).page("/:day", DayPage);
const mountedSchedule = EFFRONT.Routes.make()
  .page("/about", HomePage)
  .mount("/Schedule", scheduleRoutes);
// @ts-expect-error A mounted root still conflicts with a differently cased local path.
mountedSchedule.page("/schedule", HomePage);
// @ts-expect-error Renaming a parameter and changing case cannot hide a mounted collision.
mountedSchedule.page("/schedule/:slug", SlugPage);
mountedSchedule.mount(
  "/schedule",
  // @ts-expect-error A collision in any member rejects the whole mount, even with a distinct root.
  EFFRONT.Routes.make().page("/new", HomePage).page("/:slug", SlugPage),
);
// @ts-expect-error A mount must also detect collisions with pages added before it.
EFFRONT.Routes.make().page("/schedule/:slug", SlugPage).mount("/Schedule", scheduleRoutes);

// A specific static route can coexist with a parameterized matcher.
const extendedSchedule = mountedSchedule.page("/schedule/today", HomePage);
const annotatedSchedule: RoutesDefinition<
  never,
  false,
  "/about" | "/Schedule" | "/Schedule/:day" | "/schedule/today"
> = extendedSchedule;
void annotatedSchedule;
const schedulePath: RoutesPaths<typeof extendedSchedule> = "/Schedule/:day";
void schedulePath;
// @ts-expect-error Shape normalization must not replace the authored path or parameter name.
const normalizedSchedulePath: RoutesPaths<typeof extendedSchedule> = "/schedule/:slug";
void normalizedSchedulePath;

const emptyRoutes = EFFRONT.Routes.make({ layout: RootLayout });
// @ts-expect-error Empty Routes do not contribute an application destination.
EFFRONT.Routes.make().mount("/empty", emptyRoutes);

const App = EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
// @ts-expect-error Compiled routes are private to framework runtime modules.
void App.routes;
// @ts-expect-error The application Layer is private to framework runtime modules.
void App.layer;
// @ts-expect-error The React adapter is private to framework runtime modules.
void DayPage.component;
// @ts-expect-error The parameter Schema is private to framework runtime modules.
void DayPage.paramsSchema;

const CreateReport = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ title: Schema.NonEmptyString })),
  handler: ({ title }) => {
    const inferredTitle: string = title;
    void inferredTitle;
    return Effect.void;
  },
});
const directFormInvocation: Promise<void> = CreateReport(new FormData());
void directFormInvocation;
function DirectServerFnForm() {
  return <form action={CreateReport} />;
}
void DirectServerFnForm;
// @ts-expect-error A Server Function accepts the Schema's encoded input, not its decoded output.
void CreateReport({ title: "Incident report" });

const ServiceEFFRONT = Application.effront<PageService>();
const ServiceRootLayout = ServiceEFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(children),
});
const ServicePage = ServiceEFFRONT.Page.make({
  render: Effect.fn(function* () {
    yield* PageService;
    return null;
  }),
});
const serviceRoutes = ServiceEFFRONT.Routes.make({ layout: ServiceRootLayout }).page(
  "/",
  ServicePage,
);
const incompleteLayer = Layer.effect(PageService, Effect.as(LayerDependency, PageService.of({})));
EFFRONT.make({
  // @ts-expect-error The application root must define a Layout.
  routes: EFFRONT.Routes.make().page("/", HomePage),
});
EFFRONT.make({
  // @ts-expect-error The application must contain at least one reachable Page.
  routes: EFFRONT.Routes.make({ layout: RootLayout }),
});
// @ts-expect-error The declared service universe requires an implementation Layer.
ServiceEFFRONT.make({ routes: serviceRoutes });
ServiceEFFRONT.make({
  routes: serviceRoutes,
  // @ts-expect-error The application Layer must have no remaining service requirements.
  layer: incompleteLayer, // intentional invalid Layer fixture
});

const NarrowEFFRONT = Application.effront<PageService>();
const ServiceSchema = Schema.String.pipe(
  Schema.catchDecodingWithContext(() => Effect.map(LayoutService, () => Option.some("fallback"))),
);
const layoutServicePageOptions = {
  render: Effect.fn(function* () {
    yield* LayoutService;
    return null;
  }),
};
// @ts-expect-error LayoutService is not part of this application's declared contracts.
NarrowEFFRONT.Page.make(layoutServicePageOptions); // intentional invalid Effect fixture
const ProvideLayoutService = NarrowEFFRONT.Middleware.make<{ provides: LayoutService }>(
  (httpEffect) => httpEffect.pipe(Effect.provideService(LayoutService, LayoutService.of({}))),
);
const LayoutServiceEFFRONT = NarrowEFFRONT.withMiddleware(ProvideLayoutService);
LayoutServiceEFFRONT.Page.make(layoutServicePageOptions);
const ProvideLayoutDependencies = NarrowEFFRONT.Middleware.make<{
  provides: LayoutService | LayerDependency;
}>((httpEffect) =>
  httpEffect.pipe(
    Effect.provideService(LayoutService, LayoutService.of({})),
    Effect.provideService(LayerDependency, LayerDependency.of({})),
  ),
);
const LayoutDependenciesEFFRONT = NarrowEFFRONT.withMiddleware(ProvideLayoutDependencies);
LayoutDependenciesEFFRONT.Page.make({
  render: Effect.fn(function* () {
    yield* LayoutService;
    yield* LayerDependency;
    return null;
  }),
});
NarrowEFFRONT.Middleware.make<{ provides: LayoutService }>(
  // @ts-expect-error A middleware must provide every service declared in `provides`.
  // intentional invalid middleware fixture
  (httpEffect) => httpEffect,
);
const RequiresLayoutService = LayoutServiceEFFRONT.Middleware.make((httpEffect) =>
  Effect.andThen(LayoutService, httpEffect),
);
LayoutServiceEFFRONT.withMiddleware(RequiresLayoutService);
// @ts-expect-error Middleware requirements must already be available in the current scope.
NarrowEFFRONT.withMiddleware(RequiresLayoutService);
NarrowEFFRONT.Middleware.make((httpEffect) =>
  // @ts-expect-error LayoutService is not available to this middleware.
  // intentional invalid Effect fixture
  Effect.gen(function* () {
    yield* LayoutService;
    return yield* httpEffect;
  }),
);
NarrowEFFRONT.Layout.make({
  // @ts-expect-error LayoutService is not part of this application's declared contracts.
  // intentional invalid Effect fixture
  render: Effect.fn(function* ({ children }) {
    yield* LayoutService;
    return children;
  }),
});
NarrowEFFRONT.Component.make({
  // @ts-expect-error LayoutService is not part of this application's declared contracts.
  // intentional invalid Effect fixture
  render: Effect.fn(function* () {
    yield* LayoutService;
    return null;
  }),
});
NarrowEFFRONT.ServerFn.make({
  input: Schema.String,
  // @ts-expect-error LayoutService is not part of this application's declared contracts.
  // intentional invalid Effect fixture
  handler: Effect.fn(function* () {
    yield* LayoutService;
    return null;
  }),
});
NarrowEFFRONT.ServerFn.make({
  // @ts-expect-error LayoutService required by Schema decoding is outside this EFFRONT universe.
  input: ServiceSchema,
  handler: () => Effect.void,
});
const serviceSchemaPageOptions = {
  params: Schema.Struct({ value: ServiceSchema }),
  render: () => Effect.succeed(null),
};
// @ts-expect-error LayoutService required by param decoding is outside this EFFRONT universe.
NarrowEFFRONT.Page.make(serviceSchemaPageOptions);

const WideEFFRONT = Application.effront<PageService | LayoutService>();
const NarrowPage = NarrowEFFRONT.Page.make({ render: () => Effect.succeed(null) });
// @ts-expect-error An EFFRONT member belongs to one exact service universe.
WideEFFRONT.Routes.make().page("/", NarrowPage);

function ArbitraryLayout({ children }: { readonly children: ReactNode }) {
  return <main>{children}</main>;
}
function ArbitraryLoading() {
  return <p>Loading...</p>;
}
function ArbitraryPage() {
  return <h1>Home</h1>;
}
// @ts-expect-error Layout concerns must be created with EFFRONT.Layout.make.
EFFRONT.Routes.make({ layout: ArbitraryLayout });
// @ts-expect-error Loading concerns must be created with EFFRONT.Loading.make.
EFFRONT.Routes.make({ loading: ArbitraryLoading });
// @ts-expect-error Page concerns must be created with EFFRONT.Page.make.
EFFRONT.Routes.make().page("/", ArbitraryPage);

const ServiceUniverseEFFRONT = Application.effront<
  LayoutService | PageService | NestedPageService
>();
const ServiceUniverseLayout = ServiceUniverseEFFRONT.Layout.make({
  render: ({ children }) => Effect.succeed(children),
});
const ServiceUniversePage = ServiceUniverseEFFRONT.Page.make({
  render: () => Effect.succeed(null),
});
const ServiceUniverseApp = ServiceUniverseEFFRONT.make({
  layer: Layer.mergeAll(
    Layer.succeed(LayoutService, LayoutService.of({})),
    Layer.succeed(PageService, PageService.of({})),
    Layer.succeed(NestedPageService, NestedPageService.of({})),
  ),
  routes: ServiceUniverseEFFRONT.Routes.make({ layout: ServiceUniverseLayout }).page(
    "/",
    ServiceUniversePage,
  ),
});
type Services = ApplicationServices<typeof ServiceUniverseApp>;
const servicesAreExact: [Services] extends [LayoutService | PageService | NestedPageService]
  ? [LayoutService | PageService | NestedPageService] extends [Services]
    ? true
    : false
  : false = true;
void servicesAreExact;

const typecheckLoadingRenderers = (loading: boolean) => {
  EFFRONT.Loading.make({
    // @ts-expect-error Loading must be immediately renderable, not asynchronous.
    // intentional invalid renderer fixture
    render: async () => <p>Loading...</p>,
  });
  EFFRONT.Loading.make({
    // @ts-expect-error Loading is service-free and does not execute an Effect operation.
    render: () => Effect.succeed(<p>Loading...</p>),
  });
  EFFRONT.Loading.make({
    // @ts-expect-error Loading cannot hide an Effect behind a union return type.
    render: () => (loading ? <p>Loading...</p> : Effect.succeed(<p>Loading...</p>)),
  });
};
void typecheckLoadingRenderers;
