import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

test("updates edited Markdown and discovers added and removed source pages in development", async ({
  page,
  request,
}) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydrat|server rendered html|did not match/i.test(message.text()))
      errors.push(message.text());
  });
  const appRoot = fileURLToPath(new URL("../fixture/", import.meta.url));
  const indexFile = join(appRoot, "content/index.md");
  const stem = `acceptance-added-${randomUUID()}%20literal`;
  const encodedStem = encodeURIComponent(stem);
  const addedFile = join(appRoot, "content/guide", `${stem}.md`);
  const addedPath = `/manual/guide/${encodedStem}`;
  const original = await readFile(indexFile);
  await page.goto("/manual");
  await page.waitForLoadState("networkidle");
  try {
    await writeFile(
      indexFile,
      Buffer.concat([original, Buffer.from("\n\nAcceptance live update\n")]),
    );
    await expect(page.getByText("Acceptance live update", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await writeFile(addedFile, "# Added Markdown page\n\nDiscovered from the source glob.\n", {
      flag: "wx",
    });
    await expect
      .poll(async () => (await request.get(addedPath)).status(), { timeout: 10_000 })
      .toBe(200);
    await page.goto(addedPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Added Markdown page");
    await rm(addedFile);
    await expect
      .poll(async () => (await request.get(addedPath)).status(), { timeout: 10_000 })
      .toBe(404);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(errors, "Content updates must not introduce browser or hydration faults").toEqual([]);
  } finally {
    await Promise.all([writeFile(indexFile, original), rm(addedFile, { force: true })]);
  }
});
