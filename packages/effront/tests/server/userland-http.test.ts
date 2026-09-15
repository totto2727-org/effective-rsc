import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { createFetchHandler, createWorkersContextAccessors } from "effront/workers";
import { describe, expect, it } from "vite-plus/test";

import { Application } from "../../src/index";

// This spans application registration, native Effect HTTP routing and the public Fetch adapter.
// Import the public Application entry source because ordinary Vitest does not select react-server.
class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("effront/tests/userland-http/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`こんにちは、${name} さん。`),
  });
}

const workers = createWorkersContextAccessors<
  { readonly value: string },
  { readonly requestId: string }
>();

class RequestEnvironment extends Context.Service<
  RequestEnvironment,
  { readonly value: string; readonly requestId: string; readonly url: string }
>()("effront/tests/userland-http/RequestEnvironment") {}

class RequestInfo extends Context.Service<RequestInfo, { readonly url: string }>()(
  "effront/tests/userland-http/RequestInfo",
) {}

const makeApplication = () => {
  const events: Array<string> = [];
  const RequestEnvironmentLayer = Layer.effect(
    RequestEnvironment,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const { env, executionContext, request } = yield* workers.getWorkersRequestContext();
        events.push(`acquired:${executionContext.requestId}`);
        return {
          value: env.value,
          requestId: executionContext.requestId,
          url: request.url,
        };
      }),
      ({ requestId }) =>
        Effect.sync(() => {
          events.push(`released:${requestId}`);
        }),
    ),
  );

  // Match the Guide HTTP example: acquire services while registering native router routes.
  const GreetingApi = HttpRouter.use(
    Effect.fn(function* (router) {
      const greeting = yield* Greeting;
      const environment = yield* RequestEnvironment;
      yield* router.add(
        "GET",
        "/api/greeting",
        Effect.map(greeting.message("Ada"), (message) =>
          HttpServerResponse.jsonUnsafe({ message }),
        ),
      );
      yield* router.add(
        "GET",
        "/api/status",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          return HttpServerResponse.jsonUnsafe(
            { ...environment, method: request.method },
            { status: 202 },
          );
        }),
      );
    }),
  );
  const GlobalHeaders = HttpRouter.middleware(
    (httpEffect) =>
      Effect.map(httpEffect, HttpServerResponse.setHeader("x-content-type-options", "nosniff")),
    { global: true },
  );
  const ApplicationLayer = Layer.mergeAll(GreetingApi, GlobalHeaders).pipe(
    Layer.provideMerge(Layer.mergeAll(Greeting.layer, RequestEnvironmentLayer)),
  );

  const EFFRONT = Application.effront<Greeting | RequestEnvironment>();
  const ProvideRequestInfo = EFFRONT.Middleware.make<{ provides: RequestInfo }>((httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      return yield* httpEffect.pipe(Effect.provideService(RequestInfo, { url: request.url }));
    }),
  );
  const RequestEFFRONT = EFFRONT.withMiddleware(ProvideRequestInfo);
  const ScopedResponse = RequestEFFRONT.Middleware.make(() =>
    Effect.gen(function* () {
      const requestInfo = yield* RequestInfo;
      const greeting = yield* Greeting;
      const environment = yield* RequestEnvironment;
      const message = yield* greeting.message("Ada");
      return HttpServerResponse.jsonUnsafe({
        message,
        ...environment,
        scopedUrl: requestInfo.url,
      }).pipe(HttpServerResponse.setHeader("x-application-scoped", "yes"));
    }),
  );
  const Layout = EFFRONT.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const Page = EFFRONT.Page.make({
    render: () => Effect.die("Pure HTTP tests must not invoke Flight or HTML rendering."),
  });
  const app = EFFRONT.make({
    layer: ApplicationLayer,
    routes: RequestEFFRONT.withMiddleware(ScopedResponse)
      .Routes.make({ layout: Layout })
      .page("/page", Page),
  });
  return { events, handler: createFetchHandler(app) };
};

describe("userland HTTP through createFetchHandler", () => {
  it("does not map global response headers onto an unmatched route failure", async () => {
    const { events, handler } = makeApplication();
    const response = await handler(
      new Request("https://workers.test/unknown"),
      { value: "unknown" },
      { requestId: "unknown" },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBeNull();
    expect(response.headers.get("x-application-scoped")).toBeNull();
    await response.text();
    expect(events).toEqual(["acquired:unknown", "released:unknown"]);
  });
  it("executes the Guide's service-backed JSON route and retains scope until body EOF", async () => {
    const { events, handler } = makeApplication();
    const response = await handler(
      new Request("https://workers.test/api/greeting"),
      { value: "first" },
      { requestId: "one" },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-application-scoped")).toBeNull();
    expect(events).toEqual(["acquired:one"]);
    expect(await response.json()).toEqual({ message: "こんにちは、Ada さん。" });
    expect(events).toEqual(["acquired:one", "released:one"]);
  });

  it("keeps application-layer environment services request-local and preserves JSON status", async () => {
    const { events, handler } = makeApplication();
    const [first, second] = await Promise.all(
      ["one", "two"].map((requestId) =>
        handler(
          new Request(`https://workers.test/api/status?request=${requestId}`),
          { value: `env:${requestId}` },
          { requestId },
        ),
      ),
    );
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(events.filter((event) => event.startsWith("released:"))).toEqual([]);
    for (const [response, requestId] of [
      [first!, "one"],
      [second!, "two"],
    ] as const) {
      expect(response.status).toBe(202);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({
        value: `env:${requestId}`,
        requestId,
        url: `https://workers.test/api/status?request=${requestId}`,
        method: "GET",
      });
    }
    expect(events.filter((event) => event.startsWith("released:")).sort()).toEqual([
      "released:one",
      "released:two",
    ]);
  });

  it("applies global HTTP middleware to both route kinds but application middleware only to its scope", async () => {
    const { events, handler } = makeApplication();
    const api = await handler(
      new Request("https://workers.test/api/greeting"),
      { value: "api" },
      { requestId: "api" },
    );
    expect(api.headers.get("x-content-type-options")).toBe("nosniff");
    expect(api.headers.get("x-application-scoped")).toBeNull();
    await api.json();

    const page = await handler(
      new Request("https://workers.test/page"),
      { value: "page" },
      { requestId: "page" },
    );
    expect(page.status).toBe(200);
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(page.headers.get("x-application-scoped")).toBe("yes");
    expect(await page.json()).toEqual({
      message: "こんにちは、Ada さん。",
      value: "page",
      requestId: "page",
      url: "https://workers.test/page",
      scopedUrl: "/page",
    });
    expect(events).toEqual(["acquired:api", "released:api", "acquired:page", "released:page"]);
  });
});
