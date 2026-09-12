import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { generateIgnorePatterns } from "./index.ts";

const roots: string[] = [];

const createRoot = (): string => {
  const temporary = fileURLToPath(new URL("../tmp/", import.meta.url));
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(join(temporary, "gitignore-patterns-"));
  const initialized = spawnSync("git", ["init", "--quiet", root]);
  expect(initialized.status).toBe(0);
  roots.push(root);
  return root;
};

const write = (root: string, path: string, contents = ""): void => {
  const destination = join(root, path);
  mkdirSync(join(destination, ".."), { recursive: true });
  writeFileSync(destination, contents);
};

const gitIgnored = (root: string, path: string): boolean => {
  const result = spawnSync(
    "git",
    [
      "-c",
      "core.excludesFile=/dev/null",
      "-c",
      "core.ignorecase=false",
      "check-ignore",
      "--no-index",
      "-q",
      path,
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  expect(result.error).toBeUndefined();
  expect([0, 1], result.stderr).toContain(result.status);
  return result.status === 0;
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("generateIgnorePatterns", () => {
  it("matches Git for reachable paths through the public API", async () => {
    const root = createRoot();
    write(root, ".gitignore", "*.log\ncache/\n!cache/keep.log\n");
    write(root, "application.log");
    write(root, "application.ts");
    write(root, "cache/keep.log");
    write(root, "cache/other.log");

    expect(gitIgnored(root, "application.log")).toBe(true);
    expect(gitIgnored(root, "application.ts")).toBe(false);
    expect(gitIgnored(root, "cache/")).toBe(true);
    expect(gitIgnored(root, "cache/keep.log")).toBe(true);
    await expect(generateIgnorePatterns(root)).resolves.toEqual(["/application.log", "/cache/"]);
  });

  it("applies scoped nested negations without flattening excluded parents", async () => {
    const root = createRoot();
    write(root, ".gitignore", "*.log\ncache/\n!cache/keep.log\n");
    write(root, "nested/.gitignore", "!keep.log\n");
    write(root, "nested/keep.log");
    write(root, "nested/remove.log");
    write(root, "cache/keep.log");

    await expect(generateIgnorePatterns(root)).resolves.toEqual(["/cache/", "/nested/remove.log"]);
  });

  it("escapes generated VitePlus patterns without changing Git parsing", async () => {
    const root = createRoot();
    write(root, ".gitignore", "*\n!.gitignore\n");
    for (const name of [
      "back\\slash",
      "braces{a,b}",
      "brackets[1]",
      "hash#name",
      "bang!name",
      "question?name",
      "space name",
      "star*name",
    ]) {
      write(root, name);
    }

    await expect(generateIgnorePatterns(root)).resolves.toEqual([
      "/back\\\\slash",
      "/bang\\!name",
      "/braces\\{a,b\\}",
      "/brackets\\[1\\]",
      "/hash\\#name",
      "/question\\?name",
      "/space\\ name",
      "/star\\*name",
    ]);
  });

  it("does not follow symlinks or use a symbolic .gitignore", async () => {
    const root = createRoot();
    const external = createRoot();
    write(root, ".gitignore", "linked-*\n");
    write(external, "ignored.txt");
    write(external, "rules", "*\n");
    mkdirSync(join(root, "nested"));
    symlinkSync(join(external, "rules"), join(root, "nested", ".gitignore"));
    symlinkSync(external, join(root, "linked-directory"));
    symlinkSync(join(external, "ignored.txt"), join(root, "linked-file"));
    write(root, "nested/visible.txt");

    await expect(generateIgnorePatterns(root)).resolves.toEqual([
      "/linked-directory",
      "/linked-file",
    ]);
  });

  it("does not traverse Git metadata", async () => {
    const root = createRoot();
    write(root, ".gitignore", "*\n!.gitignore\n");
    write(root, ".git/secret.txt");

    await expect(generateIgnorePatterns(root)).resolves.toEqual([]);
  });

  it("loads a reachable ignore file even when its filename is ignored", async () => {
    const root = createRoot();
    write(root, ".gitignore", ".gitignore\n*.log\n");
    write(root, "nested/.gitignore", "!keep.log\n");
    write(root, "nested/keep.log");
    write(root, "nested/drop.log");
    expect(gitIgnored(root, "nested/keep.log")).toBe(false);
    await expect(generateIgnorePatterns(root)).resolves.toEqual([
      "/.gitignore",
      "/nested/.gitignore",
      "/nested/drop.log",
    ]);
  });

  it("does not inherit ignore rules outside the supplied root", async () => {
    const root = createRoot();
    write(root, ".gitignore", "*.log\n");
    write(root, "child/visible.log");
    await expect(generateIgnorePatterns(join(root, "child"))).resolves.toEqual([]);
  });

  it("regenerates snapshot entries when a new ignored file is created", async () => {
    const root = createRoot();
    write(root, ".gitignore", "*.log\n");
    const before = await generateIgnorePatterns(root);
    write(root, "new.log");
    expect(before).toEqual([]);
    await expect(generateIgnorePatterns(root)).resolves.toEqual(["/new.log"]);
  });

  it("rejects a symbolic-link root instead of scanning its target", async () => {
    const root = createRoot();
    const target = createRoot();
    symlinkSync(target, join(root, "alias"));
    await expect(generateIgnorePatterns(join(root, "alias"))).rejects.toThrow(TypeError);
  });

  it("defaults to case-sensitive matching and supports ignoreCase", async () => {
    const root = createRoot();
    write(root, ".gitignore", "FOO\n");
    write(root, "foo");

    await expect(generateIgnorePatterns(root)).resolves.toEqual([]);
    await expect(generateIgnorePatterns(root, { ignoreCase: true })).resolves.toEqual(["/foo"]);
  });

  it("accepts file URLs and rejects missing, non-directory, and non-file URL roots", async () => {
    const root = createRoot();
    write(root, ".gitignore", "ignored\n");
    write(root, "ignored");
    const file = join(root, "file");
    write(root, "file");

    await expect(generateIgnorePatterns(pathToFileURL(root))).resolves.toEqual(["/ignored"]);
    await expect(generateIgnorePatterns(join(root, "missing"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(generateIgnorePatterns(file)).rejects.toThrow(TypeError);
    await expect(generateIgnorePatterns(new URL("https://example.com"))).rejects.toThrow(TypeError);
  });
});
