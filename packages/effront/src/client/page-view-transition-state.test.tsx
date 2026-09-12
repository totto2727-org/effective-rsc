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

  it("omits the entire React boundary for reduced motion, even with custom classes", () => {
    media.reduced = true;
    expect(
      PageViewTransitionBoundary({
        config: { enabled: true, default: "custom", share: "custom-share" },
        children: "page content",
      }),
    ).toBe("page content");
  });
});
