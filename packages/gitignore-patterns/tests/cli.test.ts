import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateIgnorePatterns } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = resolve(root, "node_modules/.bin/vp");
let temporary: string;
let environment: NodeJS.ProcessEnv;
beforeAll(async () => {
  await mkdir(resolve(root, "tmp"), { recursive: true });
  temporary = await mkdtemp(resolve(root, "tmp/gitignore-acceptance-"));
  const emptyGitConfig = resolve(temporary, "empty-git-config");
  await writeFile(emptyGitConfig, "");
  environment = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    NO_COLOR: "1",
  };
});
afterAll(async () => {
  if (temporary !== undefined) await rm(temporary, { recursive: true, force: true });
});

const run = (command: string, args: string[], cwd: string, input?: string) => {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: "utf8",
    input,
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal, `${command} ${args.join(" ")} was interrupted`).toBeNull();
  return result;
};

const write = async (directory: string, name: string, contents: string) => {
  const target = resolve(directory, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
};

const writeConfig = (directory: string, patterns: string[]) =>
  write(
    directory,
    "vite.config.ts",
    `export default ${JSON.stringify({
      fmt: { ignorePatterns: patterns },
      lint: { ignorePatterns: patterns },
    })};\n`,
  );

const createFixture = async (name: string, files: string[], ignores: Record<string, string>) => {
  const directory = resolve(temporary, name);
  await mkdir(directory);
  expect(run("git", ["init", "--quiet"], directory).status).toBe(0);
  expect(run("git", ["config", "core.ignoreCase", "false"], directory).status).toBe(0);
  // A separate Git repository alone does not isolate VitePlus from the parent workspace.
  await write(directory, "pnpm-workspace.yaml", "packages: []\n");
  await write(directory, "package.json", '{"private":true,"type":"module"}\n');
  for (const file of files) {
    await write(directory, file, "debugger;const value={a:1,b:2};console.log(value)\n");
  }
  for (const [file, contents] of Object.entries(ignores)) {
    await write(directory, file, contents);
  }
  return directory;
};

const gitSelected = (directory: string, files: string[]) => {
  const result = run(
    "git",
    ["check-ignore", "--no-index", "--stdin", "-z"],
    directory,
    `${files.join("\0")}\0`,
  );
  expect([0, 1], result.stderr).toContain(result.status);
  const ignored = new Set(result.stdout.split("\0"));
  return files.filter((file) => !ignored.has(file));
};

const moveIgnores = async (
  directory: string,
  ignores: Record<string, string>,
  disable: boolean,
) => {
  for (const file of Object.keys(ignores)) {
    const original = resolve(directory, file);
    const disabled = `${original}.disabled-for-acceptance`;
    await rename(disable ? original : disabled, disable ? disabled : original);
  }
};

// Both CLIs display POSIX backslashes as slashes. Keep fixture names unambiguous after normalization.
const displayPath = (file: string) => file.replaceAll("\\", "/");
const sortedDisplayPaths = (files: string[]) => files.map(displayPath).sort();

const assertCliSelection = (
  directory: string,
  files: string[],
  expected: string[],
  label: string,
) => {
  const candidates = new Set(files.map(displayPath));
  expect(candidates.size, "Fixture display paths must be unambiguous").toBe(files.length);
  for (const [tool, flags] of [
    ["fmt", ["--list-different"]],
    ["lint", ["--debug=files"]],
  ] as const) {
    const result = run(executable, [tool, ".", ...flags], directory);
    expect(result.status, result.stderr || result.stdout).toBe(tool === "fmt" ? 1 : 0);
    const selected = result.stdout.split(/\r?\n/).filter((file) => candidates.has(file));
    expect(selected.sort(), `${label}: vp ${tool}`).toEqual(sortedDisplayPaths(expected));
  }
};

interface Scenario {
  name: string;
  ignores: Record<string, string>;
  ignored: string[];
  allowed: string[];
}
const cases: Scenario[] = [
  {
    name: "scoped-patterns",
    ignores: {
      ".gitignore": "/root-only.js\nslashless.js\ncache.js/\n",
      "pkg/.gitignore": "/anchored.js\nnested.js\nsrc/middle.js\n",
    },
    ignored: [
      "root-only.js",
      "slashless.js",
      "pkg/deep/slashless.js",
      "cache.js/inside.js",
      "pkg/cache.js/inside.js",
      "pkg/anchored.js",
      "pkg/nested.js",
      "pkg/deep/nested.js",
      "pkg/src/middle.js",
    ],
    allowed: [
      "keep.js",
      "other/root-only.js",
      "other/cache.js",
      "other/anchored.js",
      "pkg/deep/anchored.js",
      "other/nested.js",
      "pkg/deep/src/middle.js",
    ],
  },
  {
    name: "negation-and-parent-pruning",
    ignores: {
      ".gitignore":
        "blocked/\n!blocked/keep.js\n*.log.js\n!keep.log.js\nopen/*\n!open/keep.js\nreopen/\n!reopen/\nreopen/*\n!reopen/keep.js\n",
      "blocked/.gitignore": "!keep.js\n",
      "pkg/.gitignore": "!override.log.js\n",
    },
    ignored: [
      "blocked/keep.js",
      "blocked/deep/drop.js",
      "drop.log.js",
      "override.log.js",
      "pkg/drop.log.js",
      "open/drop.js",
      "open/deep/drop.js",
      "reopen/drop.js",
    ],
    allowed: [
      "keep.js",
      "keep.log.js",
      "pkg/keep.log.js",
      "pkg/override.log.js",
      "open/keep.js",
      "reopen/keep.js",
    ],
  },
  {
    name: "literal-escaping",
    ignores: {
      ".gitignore":
        [
          "#comment.js",
          String.raw`\#hash.js`,
          String.raw`\!bang.js`,
          String.raw`a\[1\].js`,
          "a{b,c}.js",
          String.raw`space\ `,
          " leading/",
          "middle space.js",
        ].join("\n") + "\n",
      "pkg[1]/.gitignore": "/drop.js\n",
    },
    ignored: [
      "#hash.js",
      "!bang.js",
      "a[1].js",
      "a{b,c}.js",
      "space /inside.js",
      " leading/inside.js",
      "middle space.js",
      "pkg[1]/drop.js",
    ],
    allowed: [
      "keep.js",
      "#comment.js",
      "hash.js",
      "bang.js",
      "a1.js",
      "ab.js",
      "ac.js",
      "space/inside.js",
      "leading/inside.js",
      "pkg1/drop.js",
      "pkg[1]/deep/drop.js",
    ],
  },
];

// These literal filename characters cannot be created on Windows.
if (process.platform !== "win32") {
  cases.push({
    name: "posix-literal-metacharacters",
    ignores: {
      ".gitignore":
        [String.raw`literal\*.js`, String.raw`literal\?.js`, String.raw`back\\slash/`].join("\n") +
        "\n",
    },
    ignored: ["literal*.js", "literal?.js", "back\\slash/inside-backslash.js"],
    allowed: [
      "keep.js",
      "literal1.js",
      "backslash/inside-plain.js",
      "back/slash/inside-separated.js",
    ],
  });
}

test.each(cases)(
  "$name: generated exclusions agree with Git and real VitePlus CLIs",
  async (scenario) => {
    const files = [...scenario.ignored, ...scenario.allowed];
    const directory = await createFixture(scenario.name, files, scenario.ignores);
    expect(gitSelected(directory, files).sort()).toEqual([...scenario.allowed].sort());
    const patterns = await generateIgnorePatterns(pathToFileURL(`${directory}/`), {
      ignoreCase: false,
    });
    expect(patterns.every((pattern) => pattern.startsWith("/"))).toBe(true);
    if (scenario.name === "negation-and-parent-pruning") {
      expect(patterns, "An excluded parent must become a directory literal").toContain("/blocked/");
      expect(patterns.some((pattern) => pattern.startsWith("/blocked/keep"))).toBe(false);
    }
    // Native .gitignore discovery would mask a broken generator and has different brace semantics.
    // Remove only fixture ignore files after generation, then prove both the baseline and exclusions.
    await moveIgnores(directory, scenario.ignores, true);
    await writeConfig(directory, []);
    assertCliSelection(directory, files, files, `${scenario.name} baseline`);
    await writeConfig(directory, patterns);
    assertCliSelection(directory, files, scenario.allowed, scenario.name);
    const lint = run(executable, ["lint", ".", "-D", "no-debugger", "--format=json"], directory);
    expect(lint.status, lint.stderr || lint.stdout).toBe(1);
    const diagnostics = (
      JSON.parse(lint.stdout) as { diagnostics: { code: string; filename: string }[] }
    ).diagnostics;
    expect(
      diagnostics
        .filter((diagnostic) => diagnostic.code === "eslint(no-debugger)")
        .map((diagnostic) => diagnostic.filename)
        .sort(),
      `${scenario.name}: actual lint diagnostics`,
    ).toEqual(sortedDisplayPaths(scenario.allowed));
  },
  60_000,
);

test("refreshes snapshots while directory exclusions cover new descendants", async () => {
  const ignores = { ".gitignore": "future-*.js\n/generated/\n" };
  const initialFiles = ["keep.js", "future-now.js", "generated/old.js"];
  const directory = await createFixture("snapshot-refresh", initialFiles, ignores);
  const first = await generateIgnorePatterns(directory, { ignoreCase: false });
  const files = [...initialFiles, "future-later.js", "generated/new.js"];
  for (const file of files.slice(initialFiles.length)) {
    await write(directory, file, "debugger;const value={a:1,b:2};console.log(value)\n");
  }
  await moveIgnores(directory, ignores, true);
  await writeConfig(directory, first);
  assertCliSelection(directory, files, ["keep.js", "future-later.js"], "snapshot before refresh");
  await moveIgnores(directory, ignores, false);
  const refreshed = await generateIgnorePatterns(directory, { ignoreCase: false });
  await moveIgnores(directory, ignores, true);
  await writeConfig(directory, refreshed);
  assertCliSelection(directory, files, ["keep.js"], "snapshot after refresh");
}, 60_000);
