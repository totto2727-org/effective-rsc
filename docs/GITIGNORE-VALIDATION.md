# Gitignore-driven tooling exclusions

The root VitePlus configuration uses `@effront/gitignore-patterns` to regenerate `fmt.ignorePatterns` and `lint.ignorePatterns` from the workspace's reachable `.gitignore` files whenever the configuration loads.
Formatting and lint rules remain VitePlus defaults.
The package delegates Gitignore parsing to [`ignore`](https://github.com/kaelzhang/node-ignore), rather than implementing the pattern grammar.

## Generation boundary

The public `generateIgnorePatterns(root)` API produces a snapshot of currently ignored filesystem entries relative to the supplied root.
Nested files can override ancestor rules only inside directories that remain reachable.
Ignored directories are emitted as directory exclusions and pruned, so their descendants need not be enumerated.
The generated patterns are escaped, root-anchored positive literals, not a concatenation of Gitignore rules.
Run the generator again after filesystem or ignore-rule changes.
The normal VitePlus command startup does this automatically.
See the [package documentation](../packages/gitignore-patterns/README.md) for the complete scope, API, and symlink policy.

## Why patterns are evaluated before export

Real VitePlus probes found different excluded-parent behavior when rules are supplied through `ignorePatterns`.
For example, `['dir/', '!dir/keep.js']` excludes `keep.js` during a formatter directory walk but includes it during the linter walk.
Flattening nested Gitignore rules into a shared list would therefore change their meaning between consumers.
Evaluating the rules first and emitting literal exclusions avoids this disagreement in the generated list.

## Native tool limitations

VitePlus also reads Gitignore files independently, so generated exclusions are additive and cannot guarantee that the final selected file set exactly equals Git's set for every valid Git pattern.
The inspected versions were local VitePlus 0.3.1, oxfmt 0.66, and oxlint 1.81.
A concrete native-loader discrepancy is `a{b,c}.js`: Git treats the braces literally, while both native tool loaders also apply brace expansion.
The generator escapes braces correctly, but cannot restore files already excluded by a consumer's native loader.
The investigated `--ignore-path` and linter `--no-ignore` flags did not disable that native Gitignore processing.
The tools also differ in symlink traversal, which is not controlled merely by this generator refusing to follow symlinks.
These upstream behaviors are outside this package's parser and require consumer-side fixes for complete parity.
No external tracker issue is created by this local-only implementation, and no upstream fix is claimed.

## Reproducing acceptance checks

- `vp test run` exercises the package's rule traversal and compares effective exclusions with real Git.
- `(cd packages/gitignore-patterns && vp run test)` exercises generated exclusions through the generator API and actual VitePlus formatter and linter commands.
- The CLI fixtures have independent Git and pnpm workspace roots and remove native Gitignore inputs after generation, so native ignores cannot mask generator failures.
- `vp fmt --check`, `vp lint`, and `vp check` check the real workspace using the generated root configuration.
- `(cd packages/e2e && vp run test)` checks that the real Workers development and standalone Wrangler workflows still work.

Temporary probes belong under ignored `tmp/` and are not package contents.

## Observed results (2026-09-12)

- Default VitePlus formatting and linting passed with the generated root configuration, and TypeScript checking passed.
- The complete unit/integration suite passed 28 files and 171 tests, including 11 generator tests.
- Real formatter/linter acceptance passed scoped rules, parent pruning and negations, escaped literal characters, POSIX filename metacharacters, and snapshot regeneration.
- All nine browser checks passed across Vite/workerd, standalone Wrangler, and overridden Wrangler bindings.
- A locally packed archive contained only ESM JavaScript, declarations, its manifest, README, and license.
- An independent Node consumer installed that archive and called the public export successfully to exclude an ignored log while retaining source.
- Frozen-lockfile installation passed.
