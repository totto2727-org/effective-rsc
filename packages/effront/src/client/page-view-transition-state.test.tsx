import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, ViewTransition, type ViewTransitionProps } from "react";

import { PageViewTransitionBoundary } from "./page-view-transition";

const media = vi.hoisted(() => ({ reduced: false }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: vi.fn(() => media.reduced),
}));

afterEach(() => {
  media.reduced = false;
});

describe("PageViewTransitionBoundary policy", () => {
  it("uses a stable shared page name and forwards React event classes", () => {
    const config = {
      default: "page",
      enter: "enter",
      exit: "exit",
      share: { default: "share", "navigation-back": "back" },
      update: "update",
    };
    const element = PageViewTransitionBoundary({ config, children: "page content" });
    expect(isValidElement<ViewTransitionProps>(element)).toBe(true);
    if (!isValidElement<ViewTransitionProps>(element)) {
      throw new TypeError("Expected a ViewTransition element.");
    }
    expect(element.type).toBe(ViewTransition);
    expect(element.props).toEqual({ ...config, name: "effront-page", children: "page content" });
  });

  it("omits the React boundary when disabled", () => {
    expect(
      PageViewTransitionBoundary({ config: { enabled: false }, children: "page content" }),
    ).toBe("page content");
  });

  it("keeps the React boundary stable with animation classes disabled for reduced motion", () => {
    media.reduced = true;
    const element = PageViewTransitionBoundary({
      config: { enabled: true, default: "custom", share: "custom-share" },
      children: "page content",
    });
    expect(isValidElement(element) && element.type).toBe(ViewTransition);
    if (!isValidElement<ViewTransitionProps>(element)) {
      throw new TypeError("Expected a ViewTransition element.");
    }
    expect(element.props).toEqual({
      name: "effront-page",
      default: "none",
      enter: "none",
      exit: "none",
      share: "none",
      update: "none",
      children: "page content",
    });
    const css = readFileSync(new URL("./page-view-transition.css", import.meta.url), "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    for (const pseudo of ["group", "image-pair", "old", "new"]) {
      expect(css).toContain(`::view-transition-${pseudo}(root)`);
    }
    expect(css).toContain("animation: none !important");
    expect(css).not.toContain("(*)");
  });
});
