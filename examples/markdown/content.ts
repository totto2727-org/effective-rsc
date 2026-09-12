import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  source: "./content",
  basePath: "/manual",
  documents: import.meta.glob<string>("./content/**/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  assets: import.meta.glob<string>("./content/**/*.{svg,png,jpg,jpeg,gif,webp,pdf}", {
    query: "?url&no-inline",
    import: "default",
    eager: true,
  }),
});
