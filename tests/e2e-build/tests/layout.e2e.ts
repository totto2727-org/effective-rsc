import { writeFile } from "node:fs/promises";
import { expect, test as base, type Locator, type Page } from "@playwright/test";

// Content completeness and provenance belong to app/docs unit tests. These small
// independent pages exercise the framework's persistent documentation-shell contract.
const routes = [
  { path: "/manual", title: "Markdown manual" },
  { path: "/manual/guide/getting-started", title: "Getting started" },
  { path: "/manual/guide/deep/details", title: "Deep details" },
  { path: `/manual/guide/${encodeURIComponent("日本語 space")}`, title: "Unicode page" },
];

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

test.describe("documentation shell without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const route of routes) {
    test(`renders article, navigation and heading anchors for ${route.title}`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      const article = page.locator("main article");
      await expect(article).toHaveAttribute("data-doc-page", route.path);
      await expect(article.getByRole("heading", { level: 1 })).toHaveText(route.title);
      expect(await page.title()).toContain(route.title);
      const sidebar = page.locator('[data-sidebar="sidebar"]');
      await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", route.path);
      for (const destination of routes) {
        await expect(
          sidebar.getByRole("link", { name: destination.title, exact: true }),
        ).toHaveAttribute("href", destination.path);
      }
      const toc = page.getByRole("complementary", { name: "このページ内" }).locator('a[href^="#"]');
      expect(await toc.count()).toBeGreaterThan(0);
      for (const link of await toc.all()) {
        const href = await link.getAttribute("href");
        if (!href) throw new Error("Expected a heading anchor");
        await expect(
          article.locator(`[id=${JSON.stringify(decodeURIComponent(href.slice(1)))}]`),
        ).toHaveCount(1);
      }
      await expectNoHorizontalOverflow(page);
    });
  }
});

test("filters sidebar links and recovers from an empty search result", async ({ page }) => {
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  const sidebar = page.locator('[data-sidebar="sidebar"]:visible');
  const filter = sidebar.getByRole("textbox", { name: "ガイドを絞り込む" });
  await filter.fill("Unicode");
  await expect(sidebar.locator('a[data-sidebar="menu-button"]')).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: "Unicode page", exact: true })).toBeVisible();
  await filter.fill("no-matching-document");
  await expect(sidebar.locator('a[data-sidebar="menu-button"]')).toHaveCount(0);
  await filter.fill("");
  await expect(sidebar.locator('a[data-sidebar="menu-button"]')).toHaveCount(routes.length);
  await expectUnclippedSidebarLabels(sidebar);
});

test("preserves sidebar DOM, scroll and search while only articles transition across navigation and history", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 420 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  const sidebar = page.locator('[data-sidebar="sidebar"]:visible');
  const filter = sidebar.getByRole("textbox", { name: "ガイドを絞り込む" });
  await filter.fill(" ");
  await expect(sidebar.locator('a[data-sidebar="menu-button"]')).toHaveCount(routes.length);
  const retained = await page.evaluateHandle(() => {
    const sidebar = document.querySelector('[data-sidebar="sidebar"]');
    const scroller = sidebar?.querySelector<HTMLElement>('[data-sidebar="content"]');
    const filter = sidebar?.querySelector("input");
    if (!sidebar || !scroller || !filter) throw new Error("Expected rendered sidebar controls");
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    return { sidebar, scroller, filter, scrollTop: scroller.scrollTop };
  });
  expect(await retained.evaluate((before) => before.scrollTop)).toBeGreaterThan(20);

  const expectRetainedSidebar = async () => {
    const state = await retained.evaluate((before) => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      const scroller = sidebar?.querySelector<HTMLElement>('[data-sidebar="content"]');
      return {
        sidebarIdentity: sidebar === before.sidebar,
        scrollerIdentity: scroller === before.scroller,
        inputIdentity: sidebar?.querySelector("input") === before.filter,
        scrollDelta: Math.abs((scroller?.scrollTop ?? -1000) - before.scrollTop),
      };
    });
    expect(state.sidebarIdentity, "The sidebar itself must not remount").toBe(true);
    expect(state.scrollerIdentity, "The actual overflow container must not remount").toBe(true);
    expect(state.inputIdentity, "The filter input must stay mounted").toBe(true);
    expect(
      state.scrollDelta,
      "Navigation must not reset or reposition sidebar scrollTop",
    ).toBeLessThanOrEqual(1);
    await expect(filter).toHaveValue(" ");
  };

  const expectCurrentDocument = async (path: string) => {
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    const article = page.locator("main article");
    await expect(article).toHaveAttribute("data-doc-page", path);
    const currentLink = sidebar.locator('a[aria-current="page"]');
    await expect(currentLink).toHaveCount(1);
    await expect(currentLink).toHaveAttribute("href", path);
    const title = (await currentLink.innerText()).trim();
    await expect(article.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      page.getByRole("navigation", { name: "パンくずリスト" }).locator('[aria-current="page"]'),
    ).toHaveText(title);
    expect(await page.title()).toContain(title);
    const toc = page.getByRole("complementary", { name: "このページ内" }).locator('a[href^="#"]');
    expect(await toc.count()).toBeGreaterThan(0);
    for (const link of await toc.all()) {
      const href = await link.getAttribute("href");
      if (!href) throw new Error("Expected a heading anchor");
      await expect(
        article.locator(`[id=${JSON.stringify(decodeURIComponent(href.slice(1)))}]`),
      ).toHaveCount(1);
    }
    await expectRetainedSidebar();
  };

  // Pick an already visible link. Do not call scrollIntoView before/after measuring,
  // and do not let Playwright auto-scroll an offscreen sidebar link to mask a reset.
  const destination = await retained.evaluate((before) => {
    const viewport = before.scroller.getBoundingClientRect();
    const link = [...before.scroller.querySelectorAll<HTMLAnchorElement>("a[href]")].find(
      (link) => {
        const bounds = link.getBoundingClientRect();
        return (
          link.pathname !== location.pathname &&
          bounds.top + bounds.height / 2 >= viewport.top + 2 &&
          bounds.top + bounds.height / 2 <= viewport.bottom - 2
        );
      },
    );
    if (!link) throw new Error("Expected an already visible sidebar destination");
    return {
      path: link.pathname,
      x: link.getBoundingClientRect().x + 16,
      y: link.getBoundingClientRect().y + link.getBoundingClientRect().height / 2,
    };
  });

  const animationEvidence = await page.evaluateHandle(() => {
    const evidence = {
      running: true,
      frames: 0,
      observer: null as MutationObserver | null,
      targets: [] as { tag: string; page: string | null; containsSidebar: boolean }[],
      samples: [] as {
        pseudoElement: string;
        progress: number;
      }[],
    };
    // React may remove capture styles before the pseudo-element animations finish.
    // Observe native style mutations with oldValue rather than assuming the styles
    // remain on the live DOM for the entire animation. No transition API is replaced.
    evidence.observer = new MutationObserver((records) => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      for (const record of records) {
        const element = record.target;
        if (!(element instanceof HTMLElement)) continue;
        const styles = `${record.oldValue ?? ""};${element.getAttribute("style") ?? ""}`;
        if (!/view-transition-name:\s*effront-page/.test(styles)) continue;
        evidence.targets.push({
          tag: element.tagName,
          page: element.getAttribute("data-doc-page"),
          containsSidebar: sidebar !== null && element.contains(sidebar),
        });
      }
    });
    evidence.observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["style"],
    });
    const sample = () => {
      if (!evidence.running) return;
      evidence.frames++;
      for (const animation of document.getAnimations()) {
        const effect = animation.effect;
        if (!(effect instanceof KeyframeEffect) || !effect.pseudoElement?.includes("effront-page"))
          continue;
        const progress = effect.getComputedTiming().progress;
        if (
          animation.playState === "running" &&
          typeof progress === "number" &&
          progress > 0 &&
          progress < 1
        ) {
          evidence.samples.push({ pseudoElement: effect.pseudoElement, progress });
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return evidence;
  });
  await page.mouse.click(destination.x, destination.y);
  await expectCurrentDocument(destination.path);
  await expect
    .poll(() => animationEvidence.evaluate((evidence) => evidence.samples.length))
    .toBeGreaterThan(0);
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const capture = await animationEvidence.evaluate((evidence) => {
    evidence.running = false;
    evidence.observer?.disconnect();
    return { samples: evidence.samples, targets: evidence.targets };
  });
  expect(
    capture.targets.length,
    "Observe real named capture elements for the native animation",
  ).toBeGreaterThan(0);
  for (const target of capture.targets) {
    expect(target.tag, "Only the article belongs to the effront-page capture").toBe("ARTICLE");
    expect(["/manual", destination.path]).toContain(target.page);
    expect(target.containsSidebar, "The article capture must exclude the sidebar").toBe(false);
  }
  const evidencePath = testInfo.outputPath("article-only-transition.json");
  await writeFile(evidencePath, JSON.stringify(capture, null, 2));
  await testInfo.attach("article-only-transition", {
    path: evidencePath,
    contentType: "application/json",
  });
  await expectRetainedSidebar();

  // In-article links scroll the document to reach content, never the independent sidebar.
  const contentLink = page.locator('main article a[href^="/manual"]').first();
  const contentPath = await contentLink.getAttribute("href");
  if (!contentPath) throw new Error("Expected a substantive in-article documentation link");
  await contentLink.click();
  await expectCurrentDocument(contentPath);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

  const nextLink = page
    .getByRole("navigation", { name: "前後のページ" })
    .getByRole("link", { name: /次のページ/ });
  const nextPath = await nextLink.getAttribute("href");
  if (!nextPath) throw new Error("Expected a next article link");
  await nextLink.click();
  await expectCurrentDocument(nextPath);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await page
    .getByRole("navigation", { name: "前後のページ" })
    .getByRole("link", { name: /前のページ/ })
    .click();
  await expectCurrentDocument(contentPath);
  await page
    .getByRole("navigation", { name: "前後のページ" })
    .getByRole("link", { name: /次のページ/ })
    .click();
  await expectCurrentDocument(nextPath);
  const changedScroll = await retained.evaluate((before) => {
    const previous = before.scrollTop;
    before.scroller.scrollTop = before.scroller.scrollHeight - before.scroller.clientHeight;
    before.scrollTop = before.scroller.scrollTop;
    return before.scrollTop - previous;
  });
  expect(
    changedScroll,
    "History must retain the latest sidebar scroll, not an older entry's snapshot",
  ).toBeGreaterThan(20);
  await page.goBack();
  await expectCurrentDocument(contentPath);
  await page.goForward();
  await expectCurrentDocument(nextPath);

  const anchor = page
    .getByRole("complementary", { name: "このページ内" })
    .locator('a[href^="#"]')
    .last();
  const hash = await anchor.getAttribute("href");
  if (!hash) throw new Error("Expected an article heading link");
  await anchor.click();
  await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const heading = page.locator(
    `main article [id=${JSON.stringify(decodeURIComponent(hash.slice(1)))}]`,
  );
  await expect
    .poll(() => heading.evaluate((node) => node.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(() => heading.evaluate((node) => node.getBoundingClientRect().top))
    .toBeLessThan(220);
  await expectRetainedSidebar();
});

test("supports mobile sidebar keyboard dismissal and link dismissal without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/manual/guide/getting-started");
  await page.waitForLoadState("networkidle");
  await expectNoHorizontalOverflow(page);
  const toggle = page.getByRole("button", { name: "Toggle Sidebar", exact: true });
  await toggle.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expectUnclippedSidebarLabels(sheet);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: "Markdown manual", exact: true }).click();
  await expect(page).toHaveURL(/\/manual$/);
  await expect(sheet).toBeHidden();
  await expect(page.locator("main article").getByRole("heading", { level: 1 })).toHaveText(
    "Markdown manual",
  );
  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.locator("main article").getByRole("heading", { level: 1 })).toHaveText(
      route.title,
    );
    await expectNoHorizontalOverflow(page);
  }
});
