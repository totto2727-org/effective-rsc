import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  basePath: "/manual",
  documents: import.meta.glob<string>("./**/*.md", {
    base: "./content",
    query: "?raw",
    import: "default",
    eager: true,
  }),
  assets: import.meta.glob<string>("./**/*.{svg,png,jpg,jpeg,gif,webp,pdf}", {
    base: "./content",
    query: "?url&no-inline",
    import: "default",
    eager: true,
  }),
});
