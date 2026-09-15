import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

type AnimationSample = {
  name: string;
  pseudoElement: string | null;
  playState: AnimationPlayState;
  progress: number | null;
  keyframes: ComputedKeyframe[];
  pageStyle: string | null;
};

declare global {
  interface Window {
    transitionEvidence: {
      samples: AnimationSample[];
      frames: number;
      running: boolean;
      layout: Element | null;
    };
  }
}

// Observe native browser animations on every frame. Do not replace startViewTransition or
// infer an animation merely from a React callback, URL change, or generated CSS rule.
const observeAnimations = (page: Page) =>
  page.evaluate(() => {
    window.transitionEvidence = {
      samples: [],
      frames: 0,
      running: true,
      layout: document.querySelector('[aria-label="Persistent transition layout"]'),
    };
    const evidence = window.transitionEvidence;
    const observe = () => {
      if (!evidence.running) return;
      evidence.frames++;
      for (const animation of document.getAnimations()) {
        const effect = animation.effect;
        if (!(effect instanceof KeyframeEffect)) continue;
        const name = animation instanceof CSSAnimation ? animation.animationName : animation.id;
        if (!effect.pseudoElement?.includes("view-transition") && !name.startsWith("demo-"))
          continue;
        evidence.samples.push({
          name,
          pseudoElement: effect.pseudoElement,
          playState: animation.playState,
          progress: effect.getComputedTiming().progress ?? null,
          keyframes: effect.getKeyframes(),
          pageStyle: document.querySelector(".transition-card")?.getAttribute("style") ?? null,
        });
      }
      if (evidence.running) requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });

const finishObservation = async (page: Page) => {
  // Include frames after the DOM commit: React creates the pseudo-element animation tree
  // after updating the page, so an immediate getAnimations() can give a false negative.
  const frames = await page.evaluate(() => window.transitionEvidence.frames);
  await page.waitForFunction((start) => window.transitionEvidence.frames >= start + 45, frames);
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  return page.evaluate(() => {
    window.transitionEvidence.running = false;
    return window.transitionEvidence.samples;
  });
};

const visitExample = async (page: Page, mode: string) => {
  await page.goto(`/transitions/${mode}-a`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${mode} page A`);
  await expect(page.locator(".transition-card")).toHaveCSS(
    "background-color",
    "rgb(219, 234, 254)",
  );
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  await observeAnimations(page);
};

const assertLayoutRetained = async (page: Page) => {
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.transitionEvidence.layout ===
        document.querySelector('[aria-label="Persistent transition layout"]'),
    ),
  ).toBe(true);
};

const isPlaying = (sample: AnimationSample) =>
  sample.playState === "running" &&
  sample.progress !== null &&
  sample.progress > 0 &&
  sample.progress < 1;

for (const mode of ["default", "custom", "typed"] as const) {
  test(`${mode} Page transition produces real animations and preserves the layout`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await visitExample(page, mode);
    await page.getByRole("link", { name: "Next example page" }).click();
    await expect(page).toHaveURL(new RegExp(`/transitions/${mode}-b$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${mode} page B`);
    const samples = await finishObservation(page);
    const evidencePath = testInfo.outputPath("native-transition-animations.json");
    await writeFile(evidencePath, JSON.stringify(samples, null, 2));
    await testInfo.attach("native-transition-animations", {
      path: evidencePath,
      contentType: "application/json",
    });
    const playing = samples.filter(isPlaying);
    expect(playing.length).toBeGreaterThan(0);
    expect(playing.some((sample) => sample.pseudoElement?.includes("effront-page"))).toBe(true);
    if (mode !== "default") {
      const animation = mode === "typed" ? "demo-lift" : "demo-slide";
      expect(playing.some((sample) => sample.name === `${animation}-in`)).toBe(true);
      expect(playing.some((sample) => sample.name === `${animation}-out`)).toBe(true);
      expect(
        playing.some((sample) => sample.keyframes.some((keyframe) => keyframe["transform"])),
      ).toBe(true);
    } else {
      expect(playing.some((sample) => sample.name.startsWith("demo-slide"))).toBe(false);
      expect(
        playing.some((sample) => sample.keyframes.some((keyframe) => keyframe["opacity"] === "0")),
      ).toBe(true);
    }
    await assertLayoutRetained(page);
    await observeAnimations(page);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${mode} page A`);
    const backwardSamples = (await finishObservation(page)).filter(isPlaying);
    if (mode === "typed") {
      expect(backwardSamples.some((sample) => sample.name === "demo-slide-in")).toBe(true);
      expect(backwardSamples.some((sample) => sample.name.startsWith("demo-lift"))).toBe(false);
    }
    await assertLayoutRetained(page);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${mode} page B`);
    await assertLayoutRetained(page);
  });
}

test("Page opt-out navigates without page animations and retains layout state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await visitExample(page, "disabled");
  await page.getByRole("link", { name: "Next example page" }).click();
  await expect(page).toHaveURL(/\/transitions\/disabled-b$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("disabled page B");
  const samples = await finishObservation(page);
  expect(samples.filter(isPlaying)).toEqual([]);
  await assertLayoutRetained(page);
});

for (const mode of ["default", "custom"] as const) {
  test(`reduced motion suppresses ${mode} page animations without breaking navigation`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await visitExample(page, mode);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    await page.getByRole("link", { name: "Next example page" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${mode} page B`);
    const samples = await finishObservation(page);
    expect(samples.filter(isPlaying)).toEqual([]);
    await assertLayoutRetained(page);
  });
}

test("responds to reduced-motion preference changes after hydration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await visitExample(page, "default");
  const note = page.getByRole("textbox", { name: "Page note" });
  await note.fill("Keep this page-local state");
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Allow the media-query subscription and its React update to commit before checking
  // that changing accessibility preferences did not remount this page's client subtree.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(note).toHaveValue("Keep this page-local state");
  await expect(note).toBeFocused();
  await page.getByRole("link", { name: "Next example page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("default page B");
  expect((await finishObservation(page)).filter(isPlaying)).toEqual([]);
  await assertLayoutRetained(page);

  await note.fill("Keep state when motion returns");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(note).toHaveValue("Keep state when motion returns");
  await expect(note).toBeFocused();
  await observeAnimations(page);
  await page.getByRole("link", { name: "Next example page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("default page A");
  expect((await finishObservation(page)).filter(isPlaying).length).toBeGreaterThan(0);
  await assertLayoutRetained(page);
});

test("navigates and retains layout state when native View Transitions are unavailable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Simulate only the missing capability. The navigation, React render, Flight request,
  // and layout state below still run through the real application and browser.
  await page.addInitScript(() => {
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await visitExample(page, "default");
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe("undefined");
  await page.getByRole("link", { name: "Next example page" }).click();
  await expect(page).toHaveURL(/\/transitions\/default-b$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("default page B");
  expect((await finishObservation(page)).filter(isPlaying)).toEqual([]);
  await assertLayoutRetained(page);
  expect(errors).toEqual([]);
});

test("loads the shared example stylesheet on direct About entry", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 250, 252)");
  await page.getByRole("link", { name: "Back home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toBeVisible();
});
