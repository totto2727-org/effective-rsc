import { Effect } from "effect";

import { MarkdownError } from "./error.ts";

export interface MarkdownCollectionOptions {
  /** Directory shared by the eager Vite glob maps, for example `./content`. */
  readonly source: string;
  /** Absolute public page prefix, for example `/manual`. */
  readonly basePath: string;
  /** Eager Vite `?raw` imports. */
  readonly documents: Readonly<Record<string, string>>;
  /** Eager Vite `?url` imports. Vite owns asset loading and output. */
  readonly assets?: Readonly<Record<string, string>>;
}

export interface MarkdownEntry {
  readonly source: string;
  readonly content: string;
  readonly url: string;
  readonly pathname: string;
  resolveLink(href: string): Effect.Effect<string, MarkdownError>;
  resolveImage(source: string): Effect.Effect<string, MarkdownError>;
}

export interface MarkdownCollection {
  readonly entries: readonly MarkdownEntry[];
  get(pathname: string): MarkdownEntry | undefined;
  resolveLink(entry: MarkdownEntry, href: string): Effect.Effect<string, MarkdownError>;
  resolveImage(entry: MarkdownEntry, source: string): Effect.Effect<string, MarkdownError>;
}

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
const splitReference = (reference: string): readonly [string, string] => {
  const index = reference.search(/[?#]/u);
  return index < 0 ? [reference, ""] : [reference.slice(0, index), reference.slice(index)];
};
const segments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "" && part !== ".");
const encodedPathname = (parts: readonly string[]): string =>
  `/${parts.map(encodeURIComponent).join("/")}`;
const hasPrefix = (parts: readonly string[], prefix: readonly string[]): boolean =>
  parts.length > prefix.length && prefix.every((part, index) => parts[index] === part);
const markdownExtension = /\.md$/iu;

/** Creates a collection from Vite's already-loaded document and asset maps. */
export const createMarkdownCollection = (
  options: MarkdownCollectionOptions,
): Effect.Effect<MarkdownCollection, MarkdownError> =>
  Effect.gen(function* () {
    const root = segments(options.source);
    const base = segments(options.basePath);
    if (!options.source.startsWith("./") || root.length === 0 || root.includes("..")) {
      return yield* new MarkdownError({
        message: 'source must name a relative directory beginning with "./"',
      });
    }
    if (
      !options.basePath.startsWith("/") ||
      /[?#]/u.test(options.basePath) ||
      base.includes("..")
    ) {
      return yield* new MarkdownError({
        message: "basePath must be an absolute pathname without query, fragment, or traversal",
      });
    }
    const entriesByPathname = new Map<string, MarkdownEntry>();
    const entriesBySource = new Map<string, MarkdownEntry>();
    const assetMap = new Map<string, string>();

    for (const [key, url] of Object.entries(options.assets ?? {})) {
      const parts = segments(key);
      if (!key.startsWith("./") || !hasPrefix(parts, root) || parts.includes("..")) {
        return yield* new MarkdownError({ message: `asset glob key is outside source: ${key}` });
      }
      assetMap.set(encodedPathname(parts), url);
    }

    const resolveLocal = (
      entry: MarkdownEntry,
      reference: string,
      image: boolean,
    ): Effect.Effect<string, MarkdownError> =>
      Effect.gen(function* () {
        // URL policies belong to Comark/the application. Only file-relative references need mapping.
        if (
          reference.startsWith("#") ||
          reference.startsWith("/") ||
          /^[a-z][a-z\d+.-]*:/iu.test(reference)
        ) {
          return reference;
        }
        const [path, suffix] = splitReference(reference);
        if (path === "") return `${entry.url}${suffix}`;
        const relative = segments(entry.source).slice(root.length, -1);
        for (const part of path.split("/").map(decodeSegment)) {
          if (part === "" || part === ".") continue;
          if (part === "..") {
            if (relative.length === 0) {
              return yield* new MarkdownError({
                message: `reference resolves outside source: ${reference} from ${entry.source}`,
              });
            }
            relative.pop();
          } else {
            relative.push(part);
          }
        }
        const target = encodedPathname([...root, ...relative]);
        const isDocument = !image && markdownExtension.test(relative.at(-1) ?? "");
        const url = isDocument ? entriesBySource.get(target)?.url : assetMap.get(target);
        if (url === undefined) {
          return yield* new MarkdownError({
            message: `reference does not name an imported ${isDocument ? "Markdown document" : "local asset"}: ${reference} from ${entry.source}`,
          });
        }
        return `${url}${suffix}`;
      });

    for (const [key, content] of Object.entries(options.documents)) {
      const parts = segments(key);
      if (!key.startsWith("./") || !hasPrefix(parts, root) || parts.includes("..")) {
        return yield* new MarkdownError({ message: `document glob key is outside source: ${key}` });
      }
      const relative = parts.slice(root.length);
      const filename = relative.at(-1)!;
      if (!markdownExtension.test(filename) || filename.length === 3) {
        return yield* new MarkdownError({
          message: `document must have a filename ending in .md: ${key}`,
        });
      }
      const stem = filename.slice(0, -3);
      const page = [...base, ...relative.slice(0, -1), ...(stem === "index" ? [] : [stem])];
      const url = encodedPathname(page);
      if (entriesByPathname.has(url)) {
        return yield* new MarkdownError({
          message: `documents map to the same public pathname ${url}: ${key}`,
        });
      }
      const entry: MarkdownEntry = {
        source: key,
        content,
        url,
        pathname: url,
        resolveLink: (href) => resolveLocal(entry, href, false),
        resolveImage: (source) => resolveLocal(entry, source, true),
      };
      entriesBySource.set(encodedPathname(parts), entry);
      entriesByPathname.set(url, entry);
    }
    return {
      entries: [...entriesByPathname.values()].sort((left, right) =>
        left.url.localeCompare(right.url),
      ),
      get: (pathname) => {
        const [path] = splitReference(pathname);
        if (!path.startsWith("/")) return undefined;
        const parts = path
          .replace(/([^/])\/$/u, "$1")
          .slice(1)
          .split("/")
          .map(decodeSegment);
        return entriesByPathname.get(encodedPathname(parts));
      },
      resolveLink: (entry, href) => resolveLocal(entry, href, false),
      resolveImage: (entry, source) => resolveLocal(entry, source, true),
    };
  });
