import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateIgnorePatterns } from "@effective-rsc/gitignore-patterns";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = resolve(root, "node_modules/.bin/vp");
await mkdir(resolve(root, "tmp"), { recursive: true });
const temporary = await mkdtemp(resolve(root, "tmp/gitignore-acceptance-"));
const emptyGitConfig = resolve(temporary, "empty-git-config");
await writeFile(emptyGitConfig, "");
const environment = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: emptyGitConfig,
  NO_COLOR: "1",
};

const run = (command, args, cwd, input) => {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: "utf8",
    input,
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${command} ${args.join(" ")} was interrupted`);
  return result;
};

const write = async (directory, name, contents) => {
  const target = resolve(directory, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
};

const writeConfig = (directory, patterns) =>
  write(
    directory,
    "vite.config.ts",
    `export default ${JSON.stringify({
      fmt: { ignorePatterns: patterns },
      lint: { ignorePatterns: patterns },
    })};\n`,
  );

const createFixture = async (name, files, ignores) => {
  const directory = resolve(temporary, name);
  await mkdir(directory);
  assert.equal(run("git", ["init", "--quiet"], directory).status, 0);
  assert.equal(run("git", ["config", "core.ignoreCase", "false"], directory).status, 0);
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

const gitSelected = (directory, files) => {
  const result = run(
    "git",
    ["check-ignore", "--no-index", "--stdin", "-z"],
    directory,
    `${files.join("\0")}\0`,
  );
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  const ignored = new Set(result.stdout.split("\0"));
  return files.filter((file) => !ignored.has(file));
};

const moveIgnores = async (directory, ignores, disable) => {
  for (const file of Object.keys(ignores)) {
    const original = resolve(directory, file);
    const disabled = `${original}.disabled-for-acceptance`;
    await rename(disable ? original : disabled, disable ? disabled : original);
  }
};

// Both CLIs display POSIX backslashes as slashes. Keep fixture names unambiguous after normalization.
const displayPath = (file) => file.replaceAll("\\", "/");
const sortedDisplayPaths = (files) => files.map(displayPath).sort();

const assertCliSelection = (directory, files, expected, label) => {
  const candidates = new Set(files.map(displayPath));
  assert.equal(candidates.size, files.length, "Fixture display paths must be unambiguous");
  for (const [tool, flags] of [
    ["fmt", ["--list-different"]],
    ["lint", ["--debug=files"]],
  ]) {
    const result = run(executable, [tool, ".", ...flags], directory);
    assert.equal(result.status, tool === "fmt" ? 1 : 0, result.stderr || result.stdout);
    const selected = result.stdout.split(/\r?\n/).filter((file) => candidates.has(file));
    assert.deepEqual(selected.sort(), sortedDisplayPaths(expected), `${label}: vp ${tool}`);
  }
};

const cases = [
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

try {
  for (const scenario of cases) {
    const files = [...scenario.ignored, ...scenario.allowed];
    const directory = await createFixture(scenario.name, files, scenario.ignores);
    assert.deepEqual(gitSelected(directory, files).sort(), [...scenario.allowed].sort());
    const patterns = await generateIgnorePatterns(pathToFileURL(`${directory}/`), {
      ignoreCase: false,
    });
    assert.ok(patterns.every((pattern) => pattern.startsWith("/")));
    if (scenario.name === "negation-and-parent-pruning") {
      assert.ok(
        patterns.includes("/blocked/"),
        "An excluded parent must become a directory literal",
      );
      assert.ok(!patterns.some((pattern) => pattern.startsWith("/blocked/keep")));
    }
    // Native .gitignore discovery would mask a broken generator and has different brace semantics.
    // Remove only fixture ignore files after generation, then prove both the baseline and exclusions.
    await moveIgnores(directory, scenario.ignores, true);
    await writeConfig(directory, []);
    assertCliSelection(directory, files, files, `${scenario.name} baseline`);
    await writeConfig(directory, patterns);
    assertCliSelection(directory, files, scenario.allowed, scenario.name);
    const lint = run(executable, ["lint", ".", "-D", "no-debugger", "--format=json"], directory);
    assert.equal(lint.status, 1, lint.stderr || lint.stdout);
    const diagnostics = JSON.parse(lint.stdout).diagnostics;
    assert.deepEqual(
      diagnostics
        .filter((diagnostic) => diagnostic.code === "eslint(no-debugger)")
        .map((diagnostic) => diagnostic.filename)
        .sort(),
      sortedDisplayPaths(scenario.allowed),
      `${scenario.name}: actual lint diagnostics`,
    );
    console.log(`Verified generated ignorePatterns through real vp fmt/lint: ${scenario.name}`);
  }

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
  console.log("Verified snapshot reload and coverage of new descendants in excluded directories");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
