import { randomBytes, randomInt, createHash } from "node:crypto";

/** SHA-256 is intentionally fast here — these hash high-entropy random
 * tokens (refresh tokens) or short-lived, rate-limited codes (OTP), not
 * user passwords. It exists so a DB read doesn't hand out usable secrets. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** A high-entropy opaque token for refresh tokens — never a JWT, so it can be revoked server-side. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

/** A 6-digit numeric OTP code, e.g. "042817". */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
