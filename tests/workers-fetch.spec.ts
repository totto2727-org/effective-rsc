import { expect, test } from "@playwright/test";

const serverSecret = "acceptance-test-secret";

const expectations = {
  "workers-dev": { label: "Workers example", secretConfigured: false },
  "workers-wrangler-default": { label: "Workers example", secretConfigured: false },
  "workers-wrangler-overridden": { label: "Workers override", secretConfigured: true },
} as const;

const configuredProject = (name: string) => {
  const expected = expectations[name as keyof typeof expectations];
  if (expected === undefined) {
    throw new TypeError(`Unexpected Workers acceptance project: ${name}`);
  }
  return expected;
};

test("serves HTML and Flight responses without leaking server bindings", async ({
  page,
  request,
}, testInfo) => {
  const expected = configuredProject(testInfo.project.name);
  const html = await request.get("/");
  const htmlBody = await html.text();

  expect(html.status()).toBe(200);
  expect(html.headers()["content-type"]).toContain("text/html");
  expect(html.headers()["cache-control"]).toBe("private, no-store");
  expect(html.headers()["vary"]).toContain("Accept");
  expect(htmlBody).not.toContain(serverSecret);

  const flight = await request.get("/", { headers: { Accept: "text/x-component" } });
  const flightBody = await flight.text();

  expect(flight.status()).toBe(200);
  expect(flight.headers()["content-type"]).toContain("text/x-component");
  expect(flight.headers()["cache-control"]).toBe("private, no-store");
  expect(flight.headers()["vary"]).toContain("Accept");
  expect(flightBody).not.toContain(serverSecret);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(expected.label);
  await expect(page.getByTestId("secret-status")).toHaveText(
    expected.secretConfigured ? "Server secret configured" : "No server secret",
  );
  await expect(page.locator("body")).not.toContainText(serverSecret);

  for (const source of await page
    .locator("script[src]")
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).src))) {
    const asset = await request.get(source);
    expect(asset.ok()).toBeTruthy();
    expect(await asset.text()).not.toContain(serverSecret);
  }
});

test("hydrates the client counter and navigates application links", async ({ page }, testInfo) => {
  const expected = configuredProject(testInfo.project.name);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const counter = page.getByRole("button", { name: "Count: 0" });
  await expect(counter).toBeVisible();
  await counter.click();
  await expect(counter).toHaveText("Count: 1");

  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.getByTestId("label")).toHaveText(expected.label);

  await page.getByRole("link", { name: "Back home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(expected.label);
});

test("returns a non-success response for an unknown route", async ({ request }) => {
  const response = await request.get("/not-a-route");
  expect(response.status()).toBe(404);
});
