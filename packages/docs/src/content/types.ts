import type { ReactNode } from "react";

export interface DocPage {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly section: "Guide" | "Code reading";
  readonly headings: readonly { readonly id: string; readonly title: string }[];
  readonly content: () => ReactNode;
}
