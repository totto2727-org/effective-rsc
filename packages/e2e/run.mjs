import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(root, "../..");
const exampleRoot = resolve(workspace, "examples/workers");
const generatedWranglerConfig = resolve(workspace, "examples/workers/dist/rsc/wrangler.json");
const testEnvironmentFile = resolve(root, "tmp/.workers-fetch.env");
const devOrigin = "http://127.0.0.1:5174";
const wranglerOrigin = "http://127.0.0.1:8788";

const executable = (name) => resolve(root, "node_modules/.bin", name);

const run = (name, args, cwd = root) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable(name), args, { cwd, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${name} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });

const start = (label, name, args, cwd) => {
  const child = spawn(executable(name), args, { cwd, detached: true, stdio: "inherit" });
  child.once("error", (error) => {
    throw new Error(`${label} failed to start: ${error.message}`);
  });
  return child;
};

const stop = async (child, label) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGINT");
  } catch {
    child.kill("SIGINT");
  }
  await new Promise((resolveStop, rejectStop) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectStop(new Error(`${label} did not stop after SIGINT`));
    }, 10_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveStop();
    });
  });
};

const waitForServer = async (origin, label) => {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.status < 500) {
        return;
      }
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`${label} did not become ready: ${String(lastError)}`);
};

const verifyStopped = async (origin, label) => {
  try {
    await fetch(origin, { signal: AbortSignal.timeout(1_000) });
  } catch {
    return;
  }
  throw new Error(`${label} is still accepting requests`);
};

const testProject = (project) =>
  run("playwright", ["test", "--config", "playwright.config.ts", "--project", project]);

let active;
const withServer = async (label, name, args, origin, project, cwd = root) => {
  active = start(label, name, args, cwd);
  try {
    await waitForServer(origin, label);
    await testProject(project);
  } finally {
    await stop(active, label);
    active = undefined;
  }
};

try {
  await run("vp", ["build"], exampleRoot);
  await access(generatedWranglerConfig);
  await mkdir(dirname(testEnvironmentFile), { recursive: true });
  await writeFile(testEnvironmentFile, "");
  console.log(`Verified generated Wrangler configuration: ${generatedWranglerConfig}`);

  await withServer(
    "VitePlus development server",
    "vp",
    ["dev", "--host", "127.0.0.1", "--port", "5174", "--strictPort"],
    devOrigin,
    "workers-dev",
    exampleRoot,
  );
  await verifyStopped(devOrigin, "VitePlus development server");

  const wranglerArgs = [
    "dev",
    "--local",
    "--no-bundle",
    "--config",
    generatedWranglerConfig,
    "--env-file",
    testEnvironmentFile,
    "--port",
    "8788",
  ];
  await withServer(
    "Wrangler local built output",
    "wrangler",
    wranglerArgs,
    wranglerOrigin,
    "workers-wrangler-default",
  );
  await verifyStopped(wranglerOrigin, "Wrangler local built output");

  await withServer(
    "Wrangler local built output with overridden bindings",
    "wrangler",
    [
      ...wranglerArgs,
      "--var",
      "APP_LABEL:Workers override",
      "--var",
      "SERVER_TOKEN:acceptance-test-secret",
    ],
    wranglerOrigin,
    "workers-wrangler-overridden",
  );
} finally {
  await rm(testEnvironmentFile, { force: true });
  if (active !== undefined) {
    await stop(active, "active acceptance server");
  }
}
