import { createHmac } from "node:crypto";
import { generateTotpSecret, totpOtpauthUrl, verifyTotpCode } from "./totp.util";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Independent reference implementation (RFC 4226/6238), used only to generate
 * expected codes for these tests without depending on the module under test. */
function referenceTotpCode(secret: string, at: Date): string {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const key = Buffer.from(bytes);

  const counter = Math.floor(at.getTime() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

describe("totp.util", () => {
  describe("generateTotpSecret", () => {
    it("generates a base32 secret with no padding characters", () => {
      const secret = generateTotpSecret();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(secret.length).toBeGreaterThan(0);
    });

    it("generates a different secret on each call", () => {
      expect(generateTotpSecret()).not.toBe(generateTotpSecret());
    });
  });

  describe("verifyTotpCode", () => {
    it("accepts the code for the current time step", () => {
      const secret = generateTotpSecret();
      const now = new Date("2026-01-01T00:00:00Z");
      const code = referenceTotpCode(secret, now);
      expect(verifyTotpCode(secret, code, now)).toBe(true);
    });

    it("accepts a code from one adjacent step (clock drift tolerance)", () => {
      const secret = generateTotpSecret();
      const now = new Date("2026-01-01T00:00:00Z");
      const previousStep = new Date(now.getTime() - 30_000);
      const code = referenceTotpCode(secret, previousStep);
      expect(verifyTotpCode(secret, code, now)).toBe(true);
    });

    it("rejects a code from two steps away", () => {
      const secret = generateTotpSecret();
      const now = new Date("2026-01-01T00:00:00Z");
      const twoStepsAgo = new Date(now.getTime() - 60_000);
      const code = referenceTotpCode(secret, twoStepsAgo);
      expect(verifyTotpCode(secret, code, now)).toBe(false);
    });

    it("rejects a code generated for a different secret", () => {
      const secretA = generateTotpSecret();
      const secretB = generateTotpSecret();
      const now = new Date("2026-01-01T00:00:00Z");
      const codeForB = referenceTotpCode(secretB, now);
      expect(verifyTotpCode(secretA, codeForB, now)).toBe(false);
    });
  });

  describe("totpOtpauthUrl", () => {
    it("embeds the secret, issuer, and account label", () => {
      const url = totpOtpauthUrl("ABCDEFGH", "manager@freshcup.et", "Fresh Cup");
      expect(url).toContain("otpauth://totp/");
      expect(url).toContain("secret=ABCDEFGH");
      expect(url).toContain("issuer=Fresh%20Cup");
      expect(url).toContain(encodeURIComponent("Fresh Cup:manager@freshcup.et"));
    });
  });
});
