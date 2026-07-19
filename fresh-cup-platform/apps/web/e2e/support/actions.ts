import type { Page } from "@playwright/test";
import { readLatestOtp, uniqueTestPhone } from "./otp";

/**
 * Drives the real login UI (phone -> OTP -> verify) rather than seeding a session directly,
 * so this doubles as coverage of the login screen itself. Requires E2E_API_LOG_PATH (see
 * e2e/README.md) since the dev API has no real SMS provider — it logs the code instead.
 */
export async function loginAsNewCustomer(page: Page): Promise<string> {
  const phone = uniqueTestPhone();

  await page.goto("/en/login");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();

  await page.getByLabel("Verification code").waitFor();
  const code = await readLatestOtp(phone);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify & continue" }).click();

  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  return phone;
}

/** Adds the first modifier-free item on the menu grid to the cart (works regardless of seed data). */
export async function addFirstAvailableItemToCart(page: Page): Promise<void> {
  await page.goto("/en/menu");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
}
