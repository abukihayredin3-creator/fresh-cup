import { expect, test } from "@playwright/test";
import { addFirstAvailableItemToCart, loginAsNewCustomer } from "./support/actions";
import { otpLogPath } from "./support/otp";

test.describe("browsing to order completion", () => {
  test.skip(!otpLogPath(), "E2E_API_LOG_PATH not set — see e2e/README.md");

  test("a new customer can log in, add an item, and place a pickup/cash order", async ({
    page,
  }) => {
    await loginAsNewCustomer(page);

    await addFirstAvailableItemToCart(page);

    await page.goto("/en/cart");
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Checkout" })).toBeVisible();

    await page.getByRole("button", { name: "Checkout" }).click();
    await page.waitForURL(/\/checkout$/);

    // PICKUP + CASH are both the default selections — the happy path needs no extra input.
    await expect(page.getByRole("button", { name: "Pickup" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Place order" }).click();

    await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Order #/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
