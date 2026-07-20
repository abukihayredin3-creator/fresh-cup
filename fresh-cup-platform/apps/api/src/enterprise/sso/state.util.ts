import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * A stateless, HMAC-signed OAuth/SAML `state`/`RelayState` value — no DB
 * row to store or expire. Binds the state to the specific connection it
 * was issued for and a timestamp, so `verifySsoState` can reject a replayed
 * or tampered value without a lookup.
 */
export function createSsoState(secret: string, connectionId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const payload = `${connectionId}.${nonce}.${issuedAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`, "utf8").toString("base64url");
}

export function verifySsoState(
  secret: string,
  state: string,
  connectionId: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): boolean {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return false;
    const [conn, nonce, issuedAtStr, signature] = parts as [string, string, string, string];
    if (conn !== connectionId) return false;

    const payload = `${conn}.${nonce}.${issuedAtStr}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      return false;
    }

    const issuedAt = Number(issuedAtStr);
    return Number.isFinite(issuedAt) && Date.now() - issuedAt <= maxAgeMs;
  } catch {
    return false;
  }
}
