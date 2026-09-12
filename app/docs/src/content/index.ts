import { guidePages } from "./guides";
import { platformPages } from "./platforms";
import { corePages } from "./core";
import { advancedPages } from "./advanced";
import { apiReferencePages } from "./api-reference";

export const pages = [
  ...guidePages,
  ...platformPages,
  ...advancedPages,
  ...apiReferencePages,
  ...corePages,
];
export const navigation = pages.map(({ slug, title, section, group }) => ({
  slug,
  title,
  section,
  ...(group ? { group } : {}),
}));

export function getPage(slug: string) {
  const page = pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new TypeError(`Documentation route is missing content: ${slug}`);
  return page;
}
