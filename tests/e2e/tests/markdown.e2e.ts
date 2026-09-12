import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { expect, test as base } from "@playwright/test";

const unicodePath = `/manual/guide/${encodeURIComponent("日本語 space")}`;
const destinations = [
  { path: "/manual/guide/getting-started", title: "Getting started", hash: "installation" },
  { path: "/manual/guide/deep/details", title: "Deep details", hash: undefined },
  { path: unicodePath, title: "Unicode page", hash: "details" },
];

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) throw new TypeError("Markdown acceptance requires a local host baseURL");
    const errors: string[] = [];
    const remoteRequests: string[] = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL).origin) {
        remoteRequests.push(url.href);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydrat|server rendered html|did not match/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    await use(page);
    expect(errors, "No browser exceptions or React hydration faults").toEqual([]);
    expect(remoteRequests, "Markdown rendering and navigation need no remote services").toEqual([]);
  },
});

test.describe("Markdown without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders default Markdown plugins in the original server document", async ({ page }) => {
    const response = await page.goto("/manual");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-type"]).toContain("text/html");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown manual");
    await expect(page.getByRole("heading", { name: "Features", exact: true })).toHaveAttribute(
      "id",
      "features",
    );
    await expect(page.locator(".footnotes")).toBeVisible();
    await expect(page.locator(".footnotes")).toContainText("Footnote detail");
    const footnote = page.locator('sup a[href^="#"]').first();
    await expect(footnote).toBeVisible();
    const footnoteHref = await footnote.getAttribute("href");
    if (!footnoteHref) throw new Error("A footnote must link to its rendered definition");
    await expect(page.locator(`[id=${JSON.stringify(footnoteHref.slice(1))}]`)).toContainText(
      "Footnote detail",
    );
    await footnote.click();
    await expect.poll(() => new URL(page.url()).hash).toBe(footnoteHref);

    await expect(page.locator("math")).toHaveCount(2);
    await expect(page.locator(".mermaid svg")).toBeVisible();
    await expect(page.locator(".mermaid svg")).toContainText("Markdown");
    const code = page.locator("pre.shiki").first();
    await expect(code).toBeVisible();
    await expect(code.locator("code")).toHaveText('const message: string = "Hello Markdown";');
    const tokenColors = await code
      .locator("code span[style]")
      .evaluateAll((tokens) => [...new Set(tokens.map((token) => getComputedStyle(token).color))]);
    expect(tokenColors.length, "Syntax colors apply without a browser highlighter").toBeGreaterThan(
      1,
    );
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await expect(page.getByRole("checkbox").first()).toBeDisabled();
    await expect(page.getByRole("checkbox").first()).toBeChecked();
    await expect(page.getByRole("checkbox").last()).not.toBeChecked();
    await expect(page.locator('blockquote[as="note"]')).toContainText(
      "Markdown links point to source files, not hand-written website routes.",
    );
    await expect(page.locator("blockquote")).not.toContainText("[!NOTE]");
    await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toBeVisible();
  });

  test("maps source references to public URLs while retaining suffixes and external URLs", async ({
    page,
  }) => {
    await page.goto("/manual");
    await expect(page.getByRole("link", { name: "Getting started", exact: true })).toHaveAttribute(
      "href",
      "/manual/guide/getting-started?from=manual#installation",
    );
    await expect(page.getByRole("link", { name: "Deep details", exact: true })).toHaveAttribute(
      "href",
      "/manual/guide/deep/details",
    );
    await expect(page.getByRole("link", { name: "Unicode page", exact: true })).toHaveAttribute(
      "href",
      `${unicodePath}?from=manual#details`,
    );
    await expect(
      page.getByRole("link", { name: "External reference", exact: true }),
    ).toHaveAttribute("href", "https://example.com/reference?q=markdown#section");
    const localSection = page.getByRole("link", { name: "Local section", exact: true });
    await expect(localSection).toHaveAttribute("href", "#features");
    await localSection.click();
    await expect.poll(() => new URL(page.url()).hash).toBe("#features");
    await expect(page.locator("#features")).toBeInViewport();
    await page.getByRole("link", { name: "Getting started", exact: true }).click();
    await expect(page).toHaveURL(/\/manual\/guide\/getting-started\?from=manual#installation$/);
    await expect(page.locator("#installation")).toBeVisible();
  });

  test("serves a source-linked image as real Vite asset bytes and a decoded browser image", async ({
    page,
    request,
  }) => {
    await page.goto("/manual");
    const image = page.getByRole("img", { name: "Markdown diagram", exact: true });
    await expect(image).toBeVisible();
    const src = await image.getAttribute("src");
    if (!src) throw new Error("The Markdown image must resolve to a public asset URL");
    expect(src).not.toMatch(/^(?:data:|file:)/);
    const asset = await request.get(new URL(src, page.url()).href);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toMatch(/^image\//);
    expect(await asset.body()).toEqual(
      await readFile(
        new URL("../../../examples/markdown/content/images/diagram.svg", import.meta.url),
      ),
    );
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
      .toBe(true);
  });

  for (const destination of destinations) {
    test(`directly serves nested source page ${destination.title}`, async ({ page }) => {
      const response = await page.goto(destination.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(destination.title);
      if (destination.hash)
        await expect(page.locator(`[id=${JSON.stringify(destination.hash)}]`)).toBeVisible();
      await expect(page.getByRole("link", { name: "Manual home", exact: true })).toHaveAttribute(
        "href",
        "/manual",
      );
    });
  }
});

for (const destination of [{ path: "/manual", title: "Markdown manual" }, ...destinations]) {
  test(`negotiates native Flight for ${destination.title}`, async ({ request }) => {
    const response = await request.get(destination.path, {
      headers: { Accept: "text/x-component" },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/x-component");
    expect(response.headers()["vary"]).toContain("Accept");
    const body = await response.text();
    expect(body).toContain(destination.title);
    expect(body).not.toMatch(/<!doctype html/i);
    expect(body).not.toMatch(/"digest":/);
  });
}

for (const accept of ["text/html", "text/x-component"]) {
  test(`returns 404 for unknown nested Markdown content with ${accept}`, async ({ request }) => {
    const response = await request.get("/manual/guide/deep/unknown", {
      headers: { Accept: accept },
    });
    expect(response.status()).toBe(404);
  });
}

test("hydrates and follows Markdown links with Flight while retaining shared layout state", async ({
  page,
}) => {
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documentRequests.push(request.url());
  });

  for (const destination of destinations) {
    const flightPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === destination.path &&
        response.headers()["content-type"]?.includes("text/x-component") === true,
    );
    await page.getByRole("link", { name: destination.title, exact: true }).click();
    const flight = await flightPromise;
    expect(flight.status()).toBe(200);
    expect(await flight.text()).toContain(destination.title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(destination.title);
    const url = new URL(page.url());
    expect(url.pathname).toBe(destination.path);
    if (destination.hash) {
      expect(url.search).toBe("?from=manual");
      expect(url.hash).toBe(`#${destination.hash}`);
      await expect(page.locator(`[id=${JSON.stringify(destination.hash)}]`)).toBeInViewport();
    }
    await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown manual");
    await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  }
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unicode page");
  await page.getByRole("link", { name: "Manual home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Markdown manual");
  await page.getByRole("button", { name: "Count: 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 2", exact: true })).toBeVisible();
  expect(documentRequests, "Markdown and history navigation must not reload the document").toEqual(
    [],
  );
});

test("keeps the Markdown renderer, parser and highlighters outside the actual browser build", async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "markdown-wrangler", "Audit the independent built artifact");
  const response = await request.get("/acceptance-client-graph.json");
  expect(response.status()).toBe(200);
  const graph: { modules: string[]; assets: string[] } = await response.json();
  expect(graph.modules.length, "Audit a real nonempty client build").toBeGreaterThan(10);
  expect(graph.modules.some((id) => id.includes("/examples/markdown/"))).toBe(true);
  // KaTeX styles and local fonts are presentation assets, not browser parsing code.
  const implementation = [...graph.modules, ...graph.assets].filter(
    (id) => !/\.(?:css|woff2?|ttf|otf)(?:$|\?)/i.test(id),
  );
  expect(
    implementation.filter((id) =>
      /@comark|comark[+_/]|packages\/markdown\/src|shiki|oniguruma|vscode-textmate|beautiful-mermaid|katex|mathjax|markdown-it|micromark/i.test(
        id,
      ),
    ),
    "No browser Markdown parsing, math/diagram rendering, or syntax-highlighting implementation",
  ).toEqual([]);
});

test("updates edited Markdown and discovers added and removed source pages in development", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "markdown-dev",
    "Source updates belong to the development host",
  );
  test.setTimeout(45_000);
  const indexFile = new URL("../../../examples/markdown/content/index.md", import.meta.url);
  const stem = `acceptance-added-${randomUUID()}`;
  const addedFile = new URL(`../../../examples/markdown/content/guide/${stem}.md`, import.meta.url);
  const addedPath = `/manual/guide/${stem}`;
  const original = await readFile(indexFile);
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  try {
    await writeFile(
      indexFile,
      Buffer.concat([original, Buffer.from("\n\nAcceptance live update\n")]),
    );
    await expect(page.getByText("Acceptance live update", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await writeFile(addedFile, "# Added Markdown page\n\nDiscovered from the source glob.\n", {
      flag: "wx",
    });
    await expect
      .poll(async () => (await request.get(addedPath)).status(), { timeout: 10_000 })
      .toBe(200);
    await page.goto(addedPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Added Markdown page");
    await rm(addedFile);
    await expect
      .poll(async () => (await request.get(addedPath)).status(), { timeout: 10_000 })
      .toBe(404);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  } finally {
    await writeFile(indexFile, original);
    await rm(addedFile, { force: true });
  }
});
