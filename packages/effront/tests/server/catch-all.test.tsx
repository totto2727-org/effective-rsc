import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { Application } from "../../src/index";
import { createFetchHandler } from "../../src/workers";

// These exercise the real public Fetch router and request middleware, without replacing
// its matcher. Actual HTML and Flight serialization are covered by Markdown Workers e2e.
const makeHandler = () => {
  const App = Application.effront();
  const Respond = App.Middleware.make(() =>
    Effect.map(HttpRouter.RouteContext, ({ route, params }) =>
      HttpServerResponse.text(JSON.stringify({ pattern: route.path, params })),
    ),
  );
  const Layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
  const PathPage = App.Page.make({
    params: Schema.Struct({ path: Schema.String }),
    render: () => Effect.die("Request middleware must respond."),
  });
  const SlugPage = App.Page.make({
    params: Schema.Struct({ slug: Schema.String }),
    render: () => Effect.die("Request middleware must respond."),
  });
  const NestedPage = App.Page.make({
    params: Schema.Struct({ lang: Schema.String, path: Schema.String }),
    render: () => Effect.die("Request middleware must respond."),
  });
  const StaticPage = App.Page.make({
    render: () => Effect.die("Request middleware must respond."),
  });
  const routes = App.withMiddleware(Respond)
    .Routes.make({ layout: Layout })
    .mount("/manual", App.Routes.make().page("/*path", PathPage))
    .page("/manual/about", StaticPage)
    .page("/manual/:slug", SlugPage)
    .page("/localized/:lang/*path", NestedPage)
    .page("/plain", StaticPage)
    .page("/日本語/入門", StaticPage);
  return createFetchHandler(App.make({ routes }));
};

// The oracle uses Effect's real router with the same native matchers, without Effront's
// param adapter. A POST without Origin must reach the existing Server Function guard.
const makeNativeHandler = () => {
  const respond = Effect.map(HttpRouter.RouteContext, ({ route, params }) =>
    HttpServerResponse.text(JSON.stringify({ pattern: route.path, params })),
  );
  const routes = [
    "/manual/*",
    "/manual/about",
    "/manual/:slug",
    "/localized/:lang/*",
    "/plain",
    "/日本語/入門",
  ] as const;
  const routeLayers = routes.map((path) =>
    Layer.mergeAll(
      HttpRouter.add("GET", path, respond),
      HttpRouter.add(
        "POST",
        path,
        HttpServerResponse.text("Rejected a cross-origin Server Function request.", {
          status: 403,
        }),
      ),
    ),
  );
  return HttpRouter.toWebHandler(Layer.mergeAll(routeLayers[0]!, ...routeLayers.slice(1)), {
    disableLogger: true,
  });
};

describe("catch-all public Fetch routing", () => {
  it.each([
    "/manual",
    "/manual/",
    "/manual/a/b/c/d",
    "/manual/guide/%E6%97%A5%E6%9C%AC%E8%AA%9E%20space",
    "/manual/guide/%252F%252e%252e%25",
    "/manual/guide/punctuation!()'$&+,=@",
    "/manual/guide/a%3Fb%23c",
    "/manual/about",
    "/manual/hello%20there",
    "/localized/ja",
    "/localized/ja/a/b",
    "/localized/ja%2Fen/a%5Cb",
    "/plain",
    "/%E6%97%A5%E6%9C%AC%E8%AA%9E/%E5%85%A5%E9%96%80",
    "/manual/guide/%",
    "/manual/guide/%E0%A4%A",
    "/manual/guide/%FF",
    "/manual/guide/a%2fb",
    "/manual/guide/a%5Cb",
    "/manual/guide/%00",
    "/manual/guide/%1F",
    "/manual/guide/%7f",
    "/manual/guide//nested",
    "/manual/guide/./nested",
    "/manual/guide/%2e%2e/nested",
    "/manual/guide/leaf/",
    "/MANUAL/guide/leaf?query=value",
    "/manuals/a/b",
  ])("delegates %s matching and decoding to native Effect HTTP", async (pathname) => {
    const handler = makeHandler();
    const native = makeNativeHandler();
    try {
      for (const method of ["GET", "HEAD", "POST"]) {
        for (const accept of ["text/html", "text/x-component"]) {
          const request = new Request(`https://routes.test${pathname}`, {
            method,
            headers: { accept },
          });
          const expected = await native.handler(request.clone());
          const response = await handler(request, {}, {});
          expect(response.status).toBe(expected.status);
          if (method === "GET" && expected.status === 200) {
            const { pattern, params } = (await expected.json()) as {
              pattern: string;
              params: Record<string, string>;
            };
            const { "*": captured, ...named } = params;
            expect(await response.json()).toEqual({
              pattern,
              params: pattern.endsWith("/*") ? { ...named, path: captured ?? "" } : params,
            });
          } else {
            expect(await response.text()).toBe(await expected.text());
          }
        }
      }
    } finally {
      await native.dispose();
    }
  });

  it("preserves HEAD fallback and returns 404 outside registered prefixes", async () => {
    const handler = makeHandler();
    const head = await handler(
      new Request("https://routes.test/manual/a/b", { method: "HEAD" }),
      {},
      {},
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    for (const pathname of ["/manuals/a/b", "/_effront/assets/a", "/plain/unregistered"]) {
      const response = await handler(new Request(`https://routes.test${pathname}`), {}, {});
      expect(response.status).toBe(404);
      await response.body?.cancel();
    }
  });

  it("decodes the named catch-all Page schema before selecting HTML or Flight rendering", async () => {
    const App = Application.effront();
    const Layout = App.Layout.make({ render: ({ children }) => Effect.succeed(children) });
    const Page = App.Page.make({
      params: Schema.Struct({ path: Schema.Literal("allowed") }),
      render: () => Effect.die("Invalid parameters must not render."),
    });
    const handler = createFetchHandler(
      App.make({ routes: App.Routes.make({ layout: Layout }).page("/manual/*path", Page) }),
    );
    for (const accept of ["text/html", "text/x-component"]) {
      const response = await handler(
        new Request("https://routes.test/manual/not/allowed", { headers: { accept } }),
        {},
        {},
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("vary")).toBe("Accept");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      await response.body?.cancel();
    }
  });
});
