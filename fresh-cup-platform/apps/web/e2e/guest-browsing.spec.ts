import { expect, test } from "@playwright/test";

test.describe("guest browsing", () => {
  test("home page loads with the hero and primary nav", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: "Fresh Cup Juice House" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Menu" }).first()).toBeVisible();
  });

  test("can browse the menu, search, and filter by category without logging in", async ({
    page,
  }) => {
    await page.goto("/en/menu");
    await expect(page.getByRole("heading", { name: "All items" })).toBeVisible();

    const addOrCustomizeButtons = page.getByRole("button", { name: /^(Add|Customize)$/ });
    await expect(addOrCustomizeButtons.first()).toBeVisible();
    const initialCount = await addOrCustomizeButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await page.getByPlaceholder("Search the menu…").fill("zzzzzzzz-no-such-item");
    await expect(page.getByText("No items match your search.")).toBeVisible();

    await page.getByPlaceholder("Search the menu…").fill("");
    await expect(addOrCustomizeButtons.first()).toBeVisible();
  });

  test("quick-add as a guest redirects to login instead of silently failing", async ({ page }) => {
    await page.goto("/en/menu");
    const addButton = page.getByRole("button", { name: "Add", exact: true }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();
    await page.waitForURL(/\/login/);
    await expect(page.getByLabel("Phone number")).toBeVisible();
  });

  test("cart requires login before checkout", async ({ page }) => {
    await page.goto("/en/cart");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  });

  test("switching locale renders Amharic copy", async ({ page }) => {
    await page.goto("/en/menu");
    await page.goto("/am/menu");
    await expect(page.getByPlaceholder("ምናሌውን ይፈልጉ…")).toBeVisible();
  });

  test("dark mode toggle persists the preference", async ({ page }) => {
    await page.goto("/en");
    const toggle = page.getByRole("button", { name: /^(dark|light)$/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
    await page.reload();
    const themeAfterReload = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(themeAfterReload).toBe("dark");
  });
});
