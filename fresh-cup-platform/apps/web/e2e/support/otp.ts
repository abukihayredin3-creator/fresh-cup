import { readFileSync } from "node:fs";

/**
 * The dev/test API has no real SMS provider — it logs the OTP code to stdout
 * (ConsoleSmsProvider) instead. Journeys that need a real login tail that log
 * file (path supplied via E2E_API_LOG_PATH, see e2e/README.md) rather than
 * guessing or hard-coding a code.
 */
export function otpLogPath(): string | undefined {
  return process.env.E2E_API_LOG_PATH;
}

/** Polls the API log file for the most recent OTP sent to `phone`, up to `timeoutMs`. */
export async function readLatestOtp(phone: string, timeoutMs = 10_000): Promise<string> {
  const logPath = otpLogPath();
  if (!logPath) {
    throw new Error("E2E_API_LOG_PATH is not set — see e2e/README.md");
  }

  const pattern = new RegExp(
    `\\[SMS -> ${phone.replace(/[+.]/g, "\\$&")}\\][^\\n]*verification code is (\\d{6})`,
  );
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const contents = readFileSync(logPath, "utf8");
    const matches = [...contents.matchAll(new RegExp(pattern, "g"))];
    const code = matches.at(-1)?.[1];
    if (code) {
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`No OTP found for ${phone} in ${logPath} within ${timeoutMs}ms`);
}

/** A fresh-looking Ethiopian phone number per test run, to dodge the 60s resend cooldown. */
export function uniqueTestPhone(): string {
  const suffix = String(Date.now()).slice(-8);
  return `+2519${suffix}`;
}
