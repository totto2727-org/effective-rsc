"use client";

import { useSyncExternalStore, ViewTransition, type ReactNode } from "react";

import type { PageViewTransitionConfig } from "../application/page-view-transition";

import "./page-view-transition.css";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getSnapshot = () => window.matchMedia(reducedMotionQuery).matches;
const getServerSnapshot = () => false;

export function PageViewTransitionBoundary({
  children,
  config,
}: {
  readonly children?: ReactNode;
  readonly config: PageViewTransitionConfig;
}) {
  const reducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (config.enabled === false) {
    return children;
  }

  return (
    <ViewTransition
      name="effront-page"
      default={reducedMotion ? "none" : config.default}
      enter={reducedMotion ? "none" : config.enter}
      exit={reducedMotion ? "none" : config.exit}
      share={reducedMotion ? "none" : config.share}
      update={reducedMotion ? "none" : config.update}
    >
      {children}
    </ViewTransition>
  );
}
