import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { verifyIdToken } from "./jwt-verify.util";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

describe("verifyIdToken", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  const kid = "test-key-1";

  function buildIdToken(payload: Record<string, unknown>): string {
    const header = { alg: "RS256", typ: "JWT", kid };
    const headerB64 = base64Url(JSON.stringify(header));
    const payloadB64 = base64Url(JSON.stringify(payload));
    const signature = cryptoSign(
      "RSA-SHA256",
      Buffer.from(`${headerB64}.${payloadB64}`),
      privateKey,
    );
    return `${headerB64}.${payloadB64}.${base64Url(signature)}`;
  }

  function mockJwks() {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ keys: [{ ...jwk, kid, alg: "RS256" }] }),
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("verifies a correctly signed id_token and returns its payload", async () => {
    mockJwks();
    const idToken = buildIdToken({
      sub: "user-123",
      iss: "https://idp.example.com",
      aud: "client-abc",
      email: "user@example.com",
      name: "Test User",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const payload = await verifyIdToken(
      idToken,
      "https://idp.example.com/.well-known/jwks.json",
      "https://idp.example.com",
      "client-abc",
    );
    expect(payload.sub).toBe("user-123");
    expect(payload.email).toBe("user@example.com");
  });

  it("rejects a token with a tampered payload", async () => {
    mockJwks();
    const idToken = buildIdToken({
      sub: "user-123",
      iss: "https://idp.example.com",
      aud: "client-abc",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const [header, payload] = idToken.split(".");
    const forgedPayload = base64Url(
      JSON.stringify({
        sub: "attacker",
        iss: "https://idp.example.com",
        aud: "client-abc",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    const tampered = `${header}.${forgedPayload}.${idToken.split(".")[2]}`;
    void payload;

    await expect(
      verifyIdToken(
        tampered,
        "https://idp.example.com/.well-known/jwks.json",
        "https://idp.example.com",
        "client-abc",
      ),
    ).rejects.toThrow("signature verification failed");
  });

  it("rejects a token whose issuer doesn't match", async () => {
    mockJwks();
    const idToken = buildIdToken({
      sub: "user-123",
      iss: "https://evil.example.com",
      aud: "client-abc",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await expect(
      verifyIdToken(
        idToken,
        "https://idp.example.com/.well-known/jwks.json",
        "https://idp.example.com",
        "client-abc",
      ),
    ).rejects.toThrow("issuer mismatch");
  });

  it("rejects an expired token", async () => {
    mockJwks();
    const idToken = buildIdToken({
      sub: "user-123",
      iss: "https://idp.example.com",
      aud: "client-abc",
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    await expect(
      verifyIdToken(
        idToken,
        "https://idp.example.com/.well-known/jwks.json",
        "https://idp.example.com",
        "client-abc",
      ),
    ).rejects.toThrow("expired");
  });

  it("rejects a non-RS256 token", async () => {
    const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT", kid }));
    const payload = base64Url(JSON.stringify({ sub: "x" }));
    const idToken = `${header}.${payload}.`;
    await expect(
      verifyIdToken(idToken, "https://idp.example.com/.well-known/jwks.json", "iss", "aud"),
    ).rejects.toThrow("Unsupported id_token algorithm");
  });
});
