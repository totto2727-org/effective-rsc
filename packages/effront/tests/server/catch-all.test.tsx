import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
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

describe("catch-all public Fetch routing", () => {
  it.each([
    ["/manual", "/manual/*path", { path: "" }],
    ["/manual/", "/manual/*path", { path: "" }],
    ["/manual/a/b/c/d", "/manual/*path", { path: "a/b/c/d" }],
    [
      "/manual/guide/%E6%97%A5%E6%9C%AC%E8%AA%9E%20space",
      "/manual/*path",
      { path: "guide/日本語 space" },
    ],
    ["/manual/guide/%252F%252e%252e%25", "/manual/*path", { path: "guide/%2F%2e%2e%" }],
    [
      "/manual/guide/punctuation!()'$&+,=@",
      "/manual/*path",
      { path: "guide/punctuation!()'$&+,=@" },
    ],
    ["/manual/guide/a%3Fb%23c", "/manual/*path", { path: "guide/a?b#c" }],
    ["/manual/about", "/manual/about", {}],
    ["/manual/hello%20there", "/manual/:slug", { slug: "hello there" }],
    ["/localized/ja", "/localized/:lang/*path", { lang: "ja", path: "" }],
    ["/localized/ja/a/b", "/localized/:lang/*path", { lang: "ja", path: "a/b" }],
    ["/plain", "/plain", {}],
    ["/%E6%97%A5%E6%9C%AC%E8%AA%9E/%E5%85%A5%E9%96%80", "/日本語/入門", {}],
  ])(
    "matches %s with normalized named params before user middleware",
    async (pathname, pattern, params) => {
      const handler = makeHandler();
      for (const accept of ["text/html", "text/x-component"]) {
        const response = await handler(
          new Request(`https://routes.test${pathname}`, { headers: { accept } }),
          {},
          {},
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ pattern, params });
      }
    },
  );

  it.each([
    "/manual/guide/%",
    "/manual/guide/%E0%A4%A",
    "/manual/guide/%FF",
    "/manual/guide/a%2fb",
    "/manual/guide/a%5Cb",
    "/manual/guide/%00",
    "/manual/guide/%1F",
    "/manual/guide/%7f",
    "/manual/guide//nested",
  ])(
    "rejects unsafe capture %s before middleware or Server Functions execute",
    async (pathname) => {
      const handler = makeHandler();
      for (const method of ["GET", "HEAD", "POST"]) {
        const response = await handler(
          new Request(`https://routes.test${pathname}`, { method }),
          {},
          {},
        );
        expect(response.status).toBe(404);
        await response.body?.cancel();
      }
    },
  );

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
