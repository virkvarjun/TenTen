import { test, expect } from "@playwright/test";

// Shared in-memory store → run these serially.
test.describe.configure({ mode: "serial" });

test("onboarding → seeded Today view", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /continue/i }).click(); // welcome
  await page.getByRole("button", { name: /In between/i }).click(); // chronotype
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click(); // ceiling
  // add three example goals
  await page.getByRole("button", { name: /\+ Ship the product/i }).click();
  await page.getByRole("button", { name: /\+ Write & think/i }).click();
  await page.getByRole("button", { name: /\+ Inbox & ops/i }).click();
  await page.getByRole("button", { name: /continue/i }).click(); // goals → work
  await page.getByRole("button", { name: /continue/i }).click(); // work → calendar
  await page.getByRole("button", { name: /show me my first day/i }).click();

  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("Energy & schedule")).toBeVisible();
  await expect(page.locator("svg[role='img']")).toBeVisible();
});

test("create a goal → submit an ask → accept → block appears and the day rebalances", async ({
  page,
}) => {
  // Start from the seeded demo for a known state.
  await page.goto("/today");
  await page.getByRole("button", { name: /reset demo/i }).click();

  // Create a goal.
  await page.getByRole("link", { name: "Goals" }).click();
  await page.getByRole("button", { name: /add a goal/i }).click();
  await page.getByLabel(/what are you pursuing/i).fill("Learn cello");
  await page.getByRole("button", { name: /^add goal$/i }).click();
  await expect(page.getByText("Learn cello")).toBeVisible();

  // Submit an ask that lands in a trough → accept.
  await page.getByRole("link", { name: "Events" }).click();
  await page.getByLabel(/asking for your time/i).fill("Coffee with Sam at 2, 30 min");
  await page.getByRole("button", { name: /ask meridian/i }).click();
  await expect(page.getByText("Accept")).toBeVisible();
  await page.getByRole("button", { name: /add to my day/i }).click();

  // The accepted ask now appears on the timeline.
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText(/Coffee with Sam/i).first()).toBeVisible();
});
