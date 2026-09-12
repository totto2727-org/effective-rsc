import { expect, test as base, type Page } from "@playwright/test";

const baseline = "ed886996d1d3780b94166af4f798c53416d547c8";
const comparison = "9058a71dcb522ffed8eb838ef9aef3c69953dfe7";
const requiredRoutes = ["/", "/guide/getting-started", "/reading/overview"];
const readingRoutes = [
  "/reading/overview",
  "/reading/runtime",
  "/reading/rendering",
  "/reading/tooling",
  "/reading/lifetimes",
];

// Client failures must fail acceptance even when the visible server-rendered article looks correct.
const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors: string[] = [];
    const hydrationErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (/hydrat|server rendered html|did not match/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    await use(page);
    expect(pageErrors, "Uncaught browser errors").toEqual([]);
    expect(hydrationErrors, "React hydration faults").toEqual([]);
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

// This uses the browser's HTML parser with JavaScript disabled, not a client-rendered DOM or a mock.
test.describe("server-rendered public documentation", () => {
  test.use({ javaScriptEnabled: false });

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

  test("renders genuine before/after excerpts with exact immutable Git provenance", async ({
    page,
  }) => {
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
