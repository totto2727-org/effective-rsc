import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test as base, type Locator, type Page } from "@playwright/test";

const baseline = "ed886996d1d3780b94166af4f798c53416d547c8";
const comparison = "9058a71dcb522ffed8eb838ef9aef3c69953dfe7";
const requiredRoutes = [
  "/",
  "/guide/getting-started",
  "/platforms/cloudflare",
  "/reading/overview",
];
const readingRoutes = [
  "/reading/overview",
  "/reading/runtime",
  "/reading/rendering",
  "/reading/tooling",
  "/reading/lifetimes",
];
const guideApplication = `import { Effect } from "effect";
import { Application } from "effront";

const EFFRONT = Application.effront();

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body><main>{children}</main></body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<h1>Hello, Effront</h1>),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});`;
const versionDiff = `diff --git a/packages/effective-rsc/package.json b/packages/effective-rsc/package.json
index a6d8558e..06a7939e 100644
--- a/packages/effective-rsc/package.json
+++ b/packages/effective-rsc/package.json
@@ -3,2 +3,2 @@
-  "version": "0.1.4",
-  "description": "An experimental, Effect-native React Server Components framework for Bun.",
+  "version": "0.1.4-workers.0",
+  "description": "Effect-native React Server Components with a Web fetch core and Vite/Cloudflare Workers integration.",
@@ -6 +6 @@
-    "bun",
+    "cloudflare-workers",`;

// Client failures must fail acceptance even when the visible server-rendered article looks correct.
const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) throw new TypeError("Docs acceptance requires a local host baseURL");
    const origin = new URL(baseURL).origin;
    const pageErrors: string[] = [];
    const hydrationErrors: string[] = [];
    const remoteRequests: string[] = [];
    // External reference anchors are allowed. Rendering and internal navigation must stay local.
    // This observes browser requests, not outbound requests made inside workerd.
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) {
        remoteRequests.push(url.href);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (/hydrat|server rendered html|did not match/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    await use(page);
    expect(pageErrors, "Uncaught browser errors").toEqual([]);
    expect(hydrationErrors, "React hydration faults").toEqual([]);
    expect(
      remoteRequests,
      "Rendering must not fetch GitHub, APIs, or other remote resources",
    ).toEqual([]);
  },
});

const expectArticle = async (page: Page) => {
  const article = page.locator("main article");
  await expect(article).toBeVisible();
  const heading = article.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  const title = (await heading.innerText()).trim();
  expect(title.length).toBeGreaterThan(0);
  expect(await page.title()).toContain(title);
  expect((await article.innerText()).trim().length).toBeGreaterThan(title.length + 80);
  await expect(article.locator("p:not(.not-prose p)").first()).toBeVisible();
  await expect(article.getByRole("heading", { level: 2 }).first()).toBeVisible();
  return article;
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, "The document must fit the viewport").toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  expect(dimensions.body, "The body must fit the viewport").toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
};

const expectTypography = async (page: Page) => {
  const styles = await page.locator("main article").evaluate((article) => {
    const heading = article.querySelector("h1");
    const paragraph = article.querySelector("p:not(.not-prose p)");
    if (!heading || !paragraph) throw new Error("An article needs a heading and paragraph");
    const headingStyle = getComputedStyle(heading);
    const paragraphStyle = getComputedStyle(paragraph);
    return {
      headingSize: Number.parseFloat(headingStyle.fontSize),
      paragraphSize: Number.parseFloat(paragraphStyle.fontSize),
      paragraphLineHeight: Number.parseFloat(paragraphStyle.lineHeight),
      paragraphSpacing:
        Number.parseFloat(paragraphStyle.marginTop) +
        Number.parseFloat(paragraphStyle.marginBottom),
    };
  });
  expect(styles.headingSize).toBeGreaterThan(styles.paragraphSize * 1.5);
  expect(styles.paragraphLineHeight).toBeGreaterThan(styles.paragraphSize * 1.4);
  expect(styles.paragraphSpacing).toBeGreaterThan(0);
};

// Canvas normalizes computed oklch/rgb/theme colors to sRGB for WCAG luminance comparisons.
const renderedColors = (element: Element) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A canvas context is required for color measurements");
  const rgba = (color: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const style = getComputedStyle(element);
  return {
    background: rgba(style.backgroundColor),
    foreground: rgba(style.color),
    tokens:
      element.tagName === "PRE"
        ? [
            ...new Set(
              [...element.querySelectorAll(".line > span[style]")].map(
                (token) => getComputedStyle(token).color,
              ),
            ),
          ].map(rgba)
        : [],
  };
};
const luminance = (color: readonly number[]) => {
  const channel = (value: number | undefined) => {
    const normalized = (value ?? 0) / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
};
const contrast = (first: readonly number[], second: readonly number[]) =>
  (Math.max(luminance(first), luminance(second)) + 0.05) /
  (Math.min(luminance(first), luminance(second)) + 0.05);

const expectInitialDarkMode = async (page: Page) => {
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  const colors = await page.locator("body").evaluate(renderedColors);
  expect(colors.background[3], "The SSR body has an actual opaque background").toBe(255);
  expect(luminance(colors.background), "Default background must be dark").toBeLessThan(0.15);
  expect(luminance(colors.foreground)).toBeGreaterThan(luminance(colors.background));
  expect(
    contrast(colors.foreground, colors.background),
    "Default text must be readable in dark mode",
  ).toBeGreaterThanOrEqual(4.5);
};

const expectHighlightedCode = async (pre: Locator, language: string, source: string) => {
  await expect(pre).toHaveClass(/\bshiki\b/);
  await expect(pre).toHaveAttribute("data-code-block");
  await expect(pre).toHaveAttribute("data-language", language);
  // textContent preserves every newline, space, sign and angle bracket across token spans.
  expect(await pre.locator("code").textContent()).toBe(source);
  const tokens = pre.locator("code .line > span[style]");
  expect(await tokens.count(), "Shiki must emit server-rendered syntax tokens").toBeGreaterThan(5);
  const colors = await pre.evaluate(renderedColors);
  expect(
    colors.tokens.length,
    "Syntax token colors must actually apply without JavaScript",
  ).toBeGreaterThan(1);
  expect(colors.background[3]).toBe(255);
  expect(luminance(colors.background), "Code blocks must use the dark theme at SSR").toBeLessThan(
    0.15,
  );
  for (const color of colors.tokens) {
    expect(
      contrast(color, colors.background),
      "Syntax tokens must remain visible on the dark code background",
    ).toBeGreaterThanOrEqual(3);
  }
};

const expectUnclippedSidebarLabels = async (scope: Locator) => {
  const labels = await scope.locator('a[data-sidebar="menu-button"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const anchor = node as HTMLElement;
      const bounds = anchor.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(anchor);
      return {
        title: anchor.innerText,
        top: bounds.top,
        bottom: bounds.bottom,
        clipped:
          anchor.scrollHeight > anchor.clientHeight + 1 ||
          [...range.getClientRects()].some(
            (rect) =>
              rect.top < bounds.top - 1 ||
              rect.bottom > bounds.bottom + 1 ||
              rect.left < bounds.left - 1 ||
              rect.right > bounds.right + 1,
          ),
      };
    }),
  );
  expect(labels.length).toBeGreaterThan(0);
  for (const [index, label] of labels.entries()) {
    expect(label.clipped, `Sidebar label must fit its own link: ${label.title}`).toBe(false);
    const previous = labels[index - 1];
    if (previous)
      expect(label.top, `Sidebar links must not overlap: ${label.title}`).toBeGreaterThanOrEqual(
        previous.bottom - 1,
      );
  }
};

const expectServerOnlyHighlighter = async () => {
  const runDirectory = process.env["EFFRONT_DOCS_E2E_RUN_DIR"];
  if (!runDirectory) throw new TypeError("Docs acceptance requires its isolated run directory");
  const graph: { modules: string[]; assets: string[] } = JSON.parse(
    await readFile(
      join(runDirectory, "docs-wrangler/dist/client/acceptance-client-graph.json"),
      "utf8",
    ),
  );
  expect(graph.modules.length, "Audit the real nonempty client build graph").toBeGreaterThan(10);
  expect(graph.modules.some((id) => id.includes("/src/components/docs-shell.tsx"))).toBe(true);
  expect(
    [...graph.modules, ...graph.assets].filter((id) =>
      /shiki|oniguruma|vscode-textmate|oxc-transform-react/i.test(id),
    ),
    "The client bundle must not contain Shiki or the build-time native React Compiler",
  ).toEqual([]);
};

// This uses the browser's HTML parser with JavaScript disabled, not a client-rendered DOM or a mock.
test.describe("server-rendered public documentation", () => {
  test.use({ javaScriptEnabled: false, colorScheme: "light" });

  test("serves complete articles and every local navigation/content link and heading anchor without JavaScript", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const pending = [...requiredRoutes];
    const visited = new Set<string>();
    const anchors = new Map<string, Set<string>>();
    const documentIds = new Map<string, Set<string>>();
    const titles = new Map<string, string>();
    const navigationLabels = new Map<string, Set<string>>();
    let articleLinks = 0;
    let headingLinks = 0;

    while (pending.length > 0) {
      const route = pending.shift();
      if (route === undefined || visited.has(route)) continue;
      // A navigation loop or unbounded generated links should fail, not silently truncate coverage.
      expect(visited.size).toBeLessThan(100);
      visited.add(route);
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      expect(response?.headers()["content-type"], route).toContain("text/html");
      const article = await expectArticle(page);
      await expect(page).toHaveTitle(/Effront/);
      if (route === "/" || route.startsWith("/guide/")) {
        await expect(article).not.toContainText(/Cloudflare|Workers|Wrangler|workerd|Vercel/);
      }
      if (route === "/platforms/cloudflare") {
        await expect(article.locator("header p").first()).toHaveText("Platforms");
        await expect(article).toContainText("wrangler.json");
      }
      await expectInitialDarkMode(page);
      await expectTypography(page);
      await expectNoHorizontalOverflow(page);
      titles.set(route, (await article.getByRole("heading", { level: 1 }).innerText()).trim());
      documentIds.set(
        route,
        new Set(await page.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id))),
      );
      const links = await page.locator("a[href]").evaluateAll((nodes) =>
        nodes.map((node) => ({
          href: (node as HTMLAnchorElement).href,
          inArticle: node.closest("article") !== null,
          sidebarLabel:
            node.getAttribute("data-sidebar") === "menu-button"
              ? (node as HTMLAnchorElement).innerText.trim()
              : null,
        })),
      );
      for (const link of links) {
        const url = new URL(link.href);
        if (url.origin !== new URL(page.url()).origin) continue;
        const target = `${url.pathname}${url.search}`;
        if (link.inArticle) articleLinks += 1;
        if (link.sidebarLabel !== null) {
          const labels = navigationLabels.get(target) ?? new Set<string>();
          labels.add(link.sidebarLabel);
          navigationLabels.set(target, labels);
        }
        if (url.hash) {
          headingLinks += 1;
          const targets = anchors.get(target) ?? new Set<string>();
          targets.add(decodeURIComponent(url.hash.slice(1)));
          anchors.set(target, targets);
        }
        if (!visited.has(target)) pending.push(target);
      }
    }

    for (const route of [...requiredRoutes, ...readingRoutes])
      expect(visited.has(route), route).toBe(true);
    expect(articleLinks, "Articles should contain working content links").toBeGreaterThan(0);
    expect(headingLinks, "Documentation should expose heading anchors").toBeGreaterThan(0);
    expect(
      navigationLabels.size,
      "The server must render sidebar navigation",
    ).toBeGreaterThanOrEqual(requiredRoutes.length);
    // The HTML parser must preserve sidebar titles, including Japanese text, exactly as their articles.
    for (const [route, labels] of navigationLabels) {
      for (const label of labels) expect(label, `${route} sidebar title`).toBe(titles.get(route));
    }
    for (const [route, ids] of anchors) {
      for (const id of ids) expect(documentIds.get(route)?.has(id), `${route}#${id}`).toBe(true);
    }
  });

  test("renders server-highlighted guide and genuine before/after excerpts with exact immutable Git provenance", async ({
    page,
  }) => {
    await page.goto("/guide/getting-started");
    await expectHighlightedCode(
      page.locator('main article pre[data-language="tsx"]'),
      "tsx",
      guideApplication,
    );
    for (const route of readingRoutes) {
      await page.goto(route);
      const excerpts = page.locator("main article figure[data-reading-excerpt]");
      expect(await excerpts.count(), route).toBeGreaterThan(0);
      for (const excerpt of await excerpts.all()) {
        await expect(excerpt).toHaveAttribute("data-baseline", baseline);
        await expect(excerpt).toHaveAttribute("data-comparison", comparison);
        await expect(excerpt).toHaveAttribute("data-source-path", /.+/);
        await expect(excerpt.locator(":scope > pre > code")).not.toBeEmpty();
      }
    }
    await page.goto("/reading/overview");
    const diff = page.locator('figure[data-reading-excerpt="package-version"]');
    await expect(diff).toHaveAttribute("data-source-kind", "diff");
    await expect(diff.locator("figcaption")).toContainText("Before");
    await expect(diff.locator("figcaption")).toContainText(baseline);
    await expect(diff.locator("figcaption")).toContainText("After");
    await expect(diff.locator("figcaption")).toContainText(comparison);
    const code = await diff.locator(":scope > pre > code").innerText();
    expect(code).toMatch(/^-(?!--).+/m);
    expect(code).toMatch(/^\+(?!\+\+).+/m);
    await expectHighlightedCode(diff.locator(":scope > pre"), "diff", versionDiff);
  });
});

test("negotiates native Flight for documentation and returns a real 404 for unknown paths", async ({
  request,
}) => {
  for (const route of requiredRoutes) {
    const flight = await request.get(route, { headers: { Accept: "text/x-component" } });
    expect(flight.status(), route).toBe(200);
    expect(flight.headers()["content-type"]).toContain("text/x-component");
    expect(flight.headers()["vary"]).toContain("Accept");
    const body = await flight.text();
    expect(body).toMatch(/(?:^|\n)[0-9a-f]+:/);
    expect(body).toContain('"h1"');
    expect(body).not.toMatch(/(?:^|\n)[0-9a-f]+:E\{/);
    expect(body).not.toMatch(/<!doctype html/i);
  }
  for (const accept of ["text/html", "text/x-component"]) {
    const missing = await request.get("/__docs_acceptance_missing__", {
      headers: { Accept: accept },
    });
    expect(missing.status()).toBe(404);
  }
});

test("hydrates desktop navigation with readable typography and working heading links", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const sidebar = page.locator('[data-sidebar="sidebar"]:visible');
  await expectUnclippedSidebarLabels(sidebar);
  const navigationLinks = sidebar.locator('a[data-sidebar="menu-button"]');
  const navigationCount = await navigationLinks.count();
  expect(navigationCount).toBeGreaterThan(1);
  const gettingStarted = sidebar.locator('a[href="/guide/getting-started"]');
  const existingTitle = (await gettingStarted.innerText()).trim();
  const filter = sidebar.getByRole("textbox", { name: "ガイドを絞り込む" });
  await filter.fill(existingTitle);
  await expect(navigationLinks).toHaveCount(1);
  await expect(gettingStarted).toBeVisible();
  await filter.fill("__docs_acceptance_no_matching_title__");
  await expect(navigationLinks).toHaveCount(0);
  await filter.clear();
  await expect(navigationLinks).toHaveCount(navigationCount);
  await gettingStarted.click();
  await expect(page).toHaveURL(/\/guide\/getting-started$/);
  await expect(page.locator("main article").getByRole("heading", { level: 1 })).toHaveText(
    existingTitle,
  );
  await expectArticle(page);
  await expectTypography(page);
  await expectNoHorizontalOverflow(page);

  const headingId = await page
    .locator("main article h2[id], main article h3[id]")
    .first()
    .getAttribute("id");
  expect(headingId).toBeTruthy();
  const href = `#${headingId}`;
  await page
    .locator(`a[href=${JSON.stringify(href)}]:visible`)
    .first()
    .click();
  expect(new URL(page.url()).hash).toBe(href);

  const readingLink = page.locator('a[href="/reading/overview"]:visible').first();
  const readingTitle = (await readingLink.innerText()).trim();
  await readingLink.click();
  await expect(page).toHaveURL(/\/reading\/overview$/);
  await expect(page.locator("main article").getByRole("heading", { level: 1 })).toHaveText(
    readingTitle,
  );
  await expectArticle(page);
  await expectTypography(page);
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("desktop-viewport.png"),
    fullPage: false,
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("desktop.png"),
    fullPage: true,
  });
  if (testInfo.project.name === "docs-wrangler") await expectServerOnlyHighlighter();
});

test("supports mobile sidebar keyboard dismissal and link dismissal without overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guide/getting-started");
  await page.waitForLoadState("networkidle");
  await expectArticle(page);
  await expectTypography(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });

  const toggle = page.getByRole("button", { name: "Toggle Sidebar", exact: true });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expectUnclippedSidebarLabels(sheet);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile-sidebar.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(toggle).toBeFocused();

  await toggle.click();
  await expect(sheet).toBeVisible();
  const readingLink = sheet.locator('a[href="/reading/overview"]');
  const readingTitle = (await readingLink.innerText()).trim();
  await readingLink.click();
  await expect(page).toHaveURL(/\/reading\/overview$/);
  await expect(sheet).toBeHidden();
  await expect(page.locator("main article").getByRole("heading", { level: 1 })).toHaveText(
    readingTitle,
  );
  await expectArticle(page);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile-viewport.png"),
    fullPage: false,
  });
  for (const route of readingRoutes) {
    await page.goto(route);
    await expectArticle(page);
    await expectNoHorizontalOverflow(page);
  }
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile-reading.png"),
    fullPage: true,
  });
});
