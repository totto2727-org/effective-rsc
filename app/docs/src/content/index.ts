import { guidePages } from "./guides";
import { readingPages } from "./reading";

export const pages = [...guidePages, ...readingPages];
export const navigation = pages.map(({ slug, title, section }) => ({ slug, title, section }));

export function getPage(slug: string) {
  const page = pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new TypeError(`Documentation route is missing content: ${slug}`);
  return page;
}
