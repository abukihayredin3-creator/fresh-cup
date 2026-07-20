import { createSsoState, verifySsoState } from "./state.util";

const SECRET = "test-secret";

describe("SSO state util", () => {
  it("round-trips a freshly created state", () => {
    const state = createSsoState(SECRET, "conn-1");
    expect(verifySsoState(SECRET, state, "conn-1")).toBe(true);
  });

  it("rejects a state issued for a different connection", () => {
    const state = createSsoState(SECRET, "conn-1");
    expect(verifySsoState(SECRET, state, "conn-2")).toBe(false);
  });

  it("rejects a state signed with a different secret", () => {
    const state = createSsoState(SECRET, "conn-1");
    expect(verifySsoState("wrong-secret", state, "conn-1")).toBe(false);
  });

  it("rejects a tampered state payload", () => {
    const state = createSsoState(SECRET, "conn-1");
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [conn, nonce, issuedAt] = decoded.split(".");
    const tampered = Buffer.from(
      `${conn}.${nonce}.${issuedAt}.0000000000000000000000000000000000000000000000000000000000000000`,
      "utf8",
    ).toString("base64url");
    expect(verifySsoState(SECRET, tampered, "conn-1")).toBe(false);
  });

  it("rejects an expired state", () => {
    const state = createSsoState(SECRET, "conn-1");
    expect(verifySsoState(SECRET, state, "conn-1", -1)).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    expect(verifySsoState(SECRET, "not-a-valid-state", "conn-1")).toBe(false);
  });
});
