import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("the app is fully usable with animations disabled", async ({ page }) => {
  await page.goto("/today");
  // The signature curve renders statically, no waiting on animation.
  await expect(page.locator("svg[role='img']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // Navigation still works under reduced motion.
  await page.getByRole("link", { name: "Goals" }).click();
  await expect(page).toHaveURL(/\/goals/);
  await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();

  await page.getByRole("link", { name: "Events" }).click();
  await expect(page.getByLabel(/asking for your time/i)).toBeVisible();
});
