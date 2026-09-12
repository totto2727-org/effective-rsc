import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ignore from "ignore";

export interface GenerateIgnorePatternsOptions {
  /** Match patterns without case folding by default, as in Git on a case-sensitive filesystem. */
  readonly ignoreCase?: boolean;
}

interface Matcher {
  readonly directory: string;
  readonly test: (path: string) => { ignored: boolean; unignored: boolean };
}

const escapePattern = (path: string): string => path.replace(/[\\*?[\]{} #!]/g, "\\$&");

const toRootPath = (root: string | URL): string =>
  resolve(typeof root === "string" ? root : fileURLToPath(root));

const relativePath = (from: string, to: string): string => relative(from, to).split(sep).join("/");

const loadMatcher = async (
  directory: string,
  ignoreCase: boolean,
): Promise<Matcher | undefined> => {
  const ignoreFile = resolve(directory, ".gitignore");
  const metadata = await lstat(ignoreFile).catch((error: unknown) => {
    if (isMissingPath(error)) {
      return undefined;
    }

    throw error;
  });

  if (metadata === undefined || !metadata.isFile() || metadata.isSymbolicLink()) {
    return undefined;
  }

  const matcher = ignore({ ignorecase: ignoreCase });
  matcher.add(await readFile(ignoreFile, "utf8"));
  return { directory, test: matcher.test.bind(matcher) };
};

const isMissingPath = (error: unknown): error is NodeJS.ErrnoException =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT";

const isIgnored = (matchers: readonly Matcher[], path: string, directory: boolean): boolean => {
  let ignored = false;

  for (const matcher of matchers) {
    const result = matcher.test(`${relativePath(matcher.directory, path)}${directory ? "/" : ""}`);
    if (result.ignored) {
      ignored = true;
    } else if (result.unignored) {
      ignored = false;
    }
  }

  return ignored;
};

/**
 * Snapshots paths currently ignored by reachable `.gitignore` files as escaped,
 * root-relative VitePlus ignore patterns.
 */
export const generateIgnorePatterns = async (
  root: string | URL,
  options: GenerateIgnorePatternsOptions = {},
): Promise<string[]> => {
  const rootPath = toRootPath(root);
  const rootMetadata = await lstat(rootPath);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new TypeError("root must be a non-symbolic-link directory");
  }

  const patterns: string[] = [];
  const visit = async (directory: string, inheritedMatchers: readonly Matcher[]): Promise<void> => {
    const matcher = await loadMatcher(directory, options.ignoreCase ?? false);
    const matchers = matcher ? [...inheritedMatchers, matcher] : inheritedMatchers;
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    for (const entry of entries) {
      // Repository metadata is intentionally outside this snapshot's scope.
      if (entry.name === ".git") {
        continue;
      }

      const entryPath = resolve(directory, entry.name);
      const metadata = await lstat(entryPath);
      const directoryEntry = metadata.isDirectory();
      const ignored = isIgnored(matchers, entryPath, directoryEntry);
      if (ignored) {
        patterns.push(
          `/${escapePattern(relativePath(rootPath, entryPath))}${directoryEntry ? "/" : ""}`,
        );
      }

      if (directoryEntry && !ignored) {
        await visit(entryPath, matchers);
      }
    }
  };

  await visit(rootPath, []);
  return patterns.sort();
};
