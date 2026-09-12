# @effront/gitignore-patterns

Generate shared formatter and linter exclusions from a directory tree's `.gitignore` files, using the established [`ignore`](https://github.com/kaelzhang/node-ignore) parser for Gitignore syntax.

## Usage

Keep VitePlus exclusions synchronized with your project's Gitignore rules without maintaining another list:

```ts
import { generateIgnorePatterns } from "@effront/gitignore-patterns";
import { defineConfig } from "vite-plus";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  fmt: { ignorePatterns },
  lint: { ignorePatterns },
});
```

For an existing `dist/` directory ignored by the root `.gitignore`, the result includes `/dist/`.
If `nested/.gitignore` unignores `keep.log` while the root ignores `*.log`, an existing `nested/drop.log` is excluded but `nested/keep.log` is not.
An ignored parent directory cannot be reopened by a rule inside that directory.

## Key features

- Discovers reachable nested Gitignore files and preserves their directory scope and rule precedence.
- Delegates raw file parsing, comments, escapes, and negation to `ignore`.
- Produces sorted, root-anchored literal exclusions with escaped consumer glob characters, including braces.
- Prunes ignored directories instead of enumerating dependencies or generated output within them.
- Ships ESM JavaScript and TypeScript declarations with no runtime Git dependency.

## Prerequisites

Node.js 22 or later and read access to the chosen filesystem tree.
The output is intended for Gitignore-style `ignorePatterns` rooted at the same directory, such as VitePlus fmt and lint.
It is not a general-purpose minimatch or arbitrary glob configuration.

## Setup

This package is local to this workspace and has not been published to a registry.
Workspace consumers declare:

```json
{
  "devDependencies": {
    "@effront/gitignore-patterns": "workspace:*"
  }
}
```

Workspace installation builds the package's JavaScript and declarations automatically.

## API

### `generateIgnorePatterns(root, options?)`

```ts
function generateIgnorePatterns(
  root: string | URL,
  options?: { readonly ignoreCase?: boolean },
): Promise<string[]>;
```

`root` is a directory path or `file:` URL and is also the required base directory for the consuming ignore configuration.
Relative paths are resolved against the process working directory.
`ignoreCase` defaults to `false` and does not read Git's `core.ignorecase` setting.
The returned array is a deterministic snapshot of currently ignored entries, using file patterns such as `/nested/file.log` and directory patterns such as `/dist/`.
There are no negative patterns in the generated output.

Only `.gitignore` files at or below the supplied root participate.
Ancestor ignore files outside that root, global excludes, `.git/info/exclude`, and tracked-file status are not consulted.
`.git` entries are not scanned or emitted.
A reachable `.gitignore` file is loaded even when its own filename matches an ignore rule.
Symbolic-link entries can be excluded by matching rules, but their targets are never traversed and symbolic `.gitignore` files are not loaded.
The root itself must be a non-symbolic-link directory.

Filesystem failures reject the promise with the original filesystem error.
A missing root therefore retains `ENOENT`; a non-directory or symbolic-link root rejects with `TypeError`.
Non-file URLs reject through Node's URL conversion.
The tree should remain stable while scanning, because this is not an atomic filesystem snapshot or a sandbox against concurrent symlink replacement.

### Snapshot and consumer boundaries

Call the function again when files or Gitignore rules change.
A previously emitted ignored-directory pattern also covers new descendants, but newly created individually ignored files require regeneration.
Normal VitePlus command startup reloads the configuration and regenerates exclusions.
No filesystem watcher or long-lived cache is installed.

VitePlus independently reads Gitignore files, so its native exclusions are additive to this package's generated patterns.
The generated output does not guarantee exact final CLI selection for every valid Git pattern: native formatter/linter matching and symlink behavior can differ from Git.
For example, native VitePlus loaders may expand braces in `a{b,c}.js`, whereas Git treats them literally.
This package escapes the literal correctly but cannot undo exclusions already imposed by the consumer.
See the [verified tool boundaries](../../docs/GITIGNORE-VALIDATION.md) for concrete findings.
The parser's own documented Unicode matching limitations also apply.

## Development

See the repository's [AGENTS.md](../../AGENTS.md) and [verification guide](../../docs/GITIGNORE-VALIDATION.md).

## License

MIT. See [LICENSE](LICENSE).

_This README follows the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
