export interface MarkdownCollectionOptions {
  /** Source directory shared by the eager Vite glob maps, for example `./content`. */
  readonly source: string;
  /** Absolute public URL prefix for generated Markdown pages, for example `/manual`. */
  readonly basePath: string;
  /** Eager `import.meta.glob(..., { query: "?raw", import: "default", eager: true })` result. */
  readonly documents: Readonly<Record<string, string>>;
  /** Eager `import.meta.glob(..., { query: "?url", import: "default", eager: true })` result. */
  readonly assets?: Readonly<Record<string, string>>;
}

export interface MarkdownEntry {
  /** Glob-map source key, such as `./content/guides/intro.md`. */
  readonly source: string;
  /** Markdown source imported with Vite's `?raw` query. */
  readonly content: string;
  /** Public page URL, with each path segment safely percent-encoded. */
  readonly url: string;
  /** Percent-encoded browser pathname. Kept as an alias of `url` for URL APIs. */
  readonly pathname: string;
  resolveLink(href: string): string;
  resolveImage(source: string): string;
}

export interface MarkdownCollection {
  readonly entries: readonly MarkdownEntry[];
  /** Looks up an entry by its generated public pathname. */
  get(pathname: string): MarkdownEntry | undefined;
  resolveLink(entry: MarkdownEntry, href: string): string;
  resolveImage(entry: MarkdownEntry, source: string): string;
}

interface SourceEntry {
  readonly source: string;
  readonly relative: readonly string[];
}

const executableSchemes = new Set(["data", "javascript", "vbscript"]);
const schemePattern = /^([a-z][a-z\d+.-]*):/iu;
const markdownExtension = /\.md$/iu;

const fail = (message: string): never => {
  throw new TypeError(`Invalid Markdown collection: ${message}`);
};

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A literal percent is a valid filename character. Decode valid escapes once,
    // but retain malformed escapes literally instead of treating them as URL syntax.
    return segment;
  }
};

const splitReference = (reference: string): readonly [string, string] => {
  const suffixStart = reference.search(/[?#]/u);
  return suffixStart === -1
    ? [reference, ""]
    : [reference.slice(0, suffixStart), reference.slice(suffixStart)];
};

const literalSegments = (path: string, description: string): string[] => {
  const segments: string[] = [];
  for (const rawSegment of path.split("/")) {
    if (rawSegment === "" || rawSegment === ".") {
      continue;
    }
    if (rawSegment === "..") {
      fail(`${description} must not contain traversal segments`);
    }
    if (rawSegment.includes("\\") || rawSegment.includes("\0")) {
      fail(`${description} contains an invalid path segment: ${rawSegment}`);
    }
    segments.push(rawSegment);
  }
  return segments;
};

const sourceDirectory = (source: string): readonly string[] => {
  if (!source.startsWith("./")) {
    fail(`source must start with "./": ${source}`);
  }
  if (source.includes("?") || source.includes("#")) {
    fail(`source must not contain a query or fragment: ${source}`);
  }
  const segments = literalSegments(source.slice(2), "source");
  if (segments.length === 0) {
    fail("source must name a directory");
  }
  return segments;
};

const basePathSegments = (basePath: string): readonly string[] => {
  if (!basePath.startsWith("/")) {
    fail(`basePath must start with "/": ${basePath}`);
  }
  if (basePath.includes("?") || basePath.includes("#")) {
    fail(`basePath must not contain a query or fragment: ${basePath}`);
  }
  return literalSegments(basePath.slice(1), "basePath");
};

const hasPrefix = (value: readonly string[], prefix: readonly string[]): boolean =>
  value.length >= prefix.length && prefix.every((segment, index) => segment === value[index]);

const encodedPathname = (segments: readonly string[]): string =>
  `/${segments.map(encodeURIComponent).join("/")}`;

const resolveRelativeSegments = (
  from: readonly string[],
  reference: string,
  description: string,
): readonly string[] => {
  const resolved = [...from];
  for (const rawSegment of reference.split("/")) {
    if (rawSegment === "" || rawSegment === ".") {
      continue;
    }
    const segment = decodeSegment(rawSegment);
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolved.length === 0) {
        fail(`${description} resolves outside source`);
      }
      resolved.pop();
      continue;
    }
    if (segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
      fail(`${description} contains an invalid path segment: ${rawSegment}`);
    }
    resolved.push(segment);
  }
  return resolved;
};

const sourceEntry = (key: string, root: readonly string[], kind: string): SourceEntry => {
  if (!key.startsWith("./")) {
    fail(`${kind} glob key must start with "./": ${key}`);
  }
  const segments = literalSegments(key.slice(2), `${kind} glob key`);
  if (!hasPrefix(segments, root) || segments.length === root.length) {
    fail(`${kind} glob key is outside source ${encodedPathname(root)}: ${key}`);
  }
  return { source: key, relative: segments.slice(root.length) };
};

const publicPath = (
  base: readonly string[],
  relative: readonly string[],
  source: string,
): string => {
  const filename = relative.at(-1);
  if (filename === undefined) {
    return fail(`document must end in .md: ${source}`);
  }
  if (!markdownExtension.test(filename)) {
    return fail(`document must end in .md: ${source}`);
  }
  const stem = filename.slice(0, -3);
  if (stem.length === 0) {
    fail(`document has an empty filename: ${source}`);
  }
  const directory = relative.slice(0, -1);
  const pageSegments = stem === "index" ? directory : [...directory, stem];
  const segments = [...base, ...pageSegments];
  return encodedPathname(segments);
};

const assertReference = (reference: string, kind: string): void => {
  if (reference.length === 0) {
    fail(`${kind} must not be empty`);
  }
  if (/\p{Cc}/u.test(reference)) {
    fail(`${kind} must not contain control characters`);
  }
  if (/^[\t\n\r ]|[\t\n\r ]$/u.test(reference)) {
    fail(`${kind} must not have leading or trailing whitespace`);
  }
};

const appendSuffix = (url: string, suffix: string, description: string): string => {
  if (suffix === "") {
    return url;
  }
  if (url.includes("#") || (suffix.startsWith("?") && url.includes("?"))) {
    fail(
      `${description} cannot append ${suffix.startsWith("?") ? "a query" : "a fragment"} to asset URL ${url}`,
    );
  }
  return `${url}${suffix}`;
};

/**
 * Creates a static collection from eager Vite raw-document and URL-asset maps.
 *
 * `README.md` deliberately maps to `/base/README`, not to a directory index.
 * Only `index.md` receives directory-root routing.
 */
export const createMarkdownCollection = (
  options: MarkdownCollectionOptions,
): MarkdownCollection => {
  const root = sourceDirectory(options.source);
  const base = basePathSegments(options.basePath);
  const documentsBySource = new Map<
    string,
    {
      readonly content: string;
      readonly source: string;
      readonly url: string;
    }
  >();
  const entriesByPathname = new Map<string, MarkdownEntry>();
  const publicPaths = new Set<string>();
  const assetsBySource = new Map<string, string>();

  for (const [key, content] of Object.entries(options.documents)) {
    if (typeof content !== "string") {
      fail(`document glob value must be a string: ${key}`);
    }
    const document = sourceEntry(key, root, "document");
    const url = publicPath(base, document.relative, key);
    const source = encodedPathname([...root, ...document.relative]);
    if (documentsBySource.has(source)) {
      fail(`duplicate document source: ${key}`);
    }
    if (publicPaths.has(url)) {
      fail(`documents map to the same public pathname ${url}: ${key}`);
    }
    documentsBySource.set(source, { content, source: key, url });
    publicPaths.add(url);
  }

  for (const [key, url] of Object.entries(options.assets ?? {})) {
    if (typeof url !== "string") {
      fail(`asset glob value must be a string: ${key}`);
    }
    const asset = sourceEntry(key, root, "asset");
    const source = encodedPathname([...root, ...asset.relative]);
    if (assetsBySource.has(source)) {
      fail(`duplicate asset source: ${key}`);
    }
    assetsBySource.set(source, url);
  }

  const resolveLocal = (entry: MarkdownEntry, reference: string, image: boolean): string => {
    assertReference(reference, image ? "image source" : "link");
    if (reference.startsWith("#") || reference.startsWith("/") || reference.startsWith("//")) {
      return reference;
    }

    const scheme = reference.match(schemePattern)?.[1]?.toLowerCase();
    if (scheme !== undefined) {
      if (executableSchemes.has(scheme)) {
        fail(`${image ? "image source" : "link"} uses unsafe ${scheme}: scheme`);
      }
      return reference;
    }

    const [path, suffix] = splitReference(reference);
    if (path === "") {
      return image ? fail("image source must name a local asset") : `${entry.url}${suffix}`;
    }

    const entrySource = sourceEntry(entry.source, root, "entry");
    const targetRelative = resolveRelativeSegments(
      entrySource.relative.slice(0, -1),
      path,
      image ? "image source" : "link",
    );
    const targetSource = encodedPathname([...root, ...targetRelative]);

    const assetUrl = assetsBySource.get(targetSource);
    if (image) {
      if (assetUrl === undefined) {
        return fail(
          `image source does not name an imported local asset: ${reference} from ${entry.source}`,
        );
      }
      return appendSuffix(assetUrl, suffix, `image source ${reference}`);
    }

    if (markdownExtension.test(targetRelative.at(-1) ?? "")) {
      const target = documentsBySource.get(targetSource);
      if (target === undefined) {
        return fail(
          `link does not name an imported Markdown document: ${reference} from ${entry.source}`,
        );
      }
      return `${target.url}${suffix}`;
    }

    if (assetUrl === undefined) {
      return fail(`link does not name an imported local asset: ${reference} from ${entry.source}`);
    }
    return appendSuffix(assetUrl, suffix, `link ${reference}`);
  };

  const entries: MarkdownEntry[] = [];
  for (const document of documentsBySource.values()) {
    const entry: MarkdownEntry = {
      source: document.source,
      content: document.content,
      pathname: document.url,
      url: document.url,
      resolveLink: (href) => resolveLocal(entry, href, false),
      resolveImage: (imageSource) => resolveLocal(entry, imageSource, true),
    };
    entriesByPathname.set(entry.url, entry);
    entries.push(entry);
  }
  entries.sort((left, right) => left.pathname.localeCompare(right.pathname));

  return {
    entries,
    get: (pathname) => {
      const [path] = splitReference(pathname);
      if (!path.startsWith("/")) {
        return undefined;
      }
      // Keep empty segments distinct, allowing only a single trailing slash alias.
      // Decode and re-encode each segment so an encoded slash never becomes hierarchy.
      const segments = path
        .replace(/([^/])\/$/u, "$1")
        .slice(1)
        .split("/")
        .map(decodeSegment);
      return entriesByPathname.get(encodedPathname(segments));
    },
    resolveLink: (entry, href) => resolveLocal(entry, href, false),
    resolveImage: (entry, imageSource) => resolveLocal(entry, imageSource, true),
  };
};
