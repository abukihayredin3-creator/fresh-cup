import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import type { SsoConnection } from "@prisma/client";
import { SsoOidcProvider } from "./oidc.sso-provider";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

const ISSUER = "https://idp.example.com";
const CLIENT_ID = "client-abc";

const CONNECTION = {
  id: "conn-1",
  config: { issuer: ISSUER, clientId: CLIENT_ID },
  clientSecretEnvVar: "TEST_OIDC_CLIENT_SECRET",
} as unknown as SsoConnection;

describe("SsoOidcProvider", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  const kid = "key-1";

  function buildIdToken(overrides: Record<string, unknown> = {}): string {
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
    const payload = base64Url(
      JSON.stringify({
        sub: "user-123",
        iss: ISSUER,
        aud: CLIENT_ID,
        email: "user@example.com",
        name: "Test User",
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides,
      }),
    );
    const signature = cryptoSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey);
    return `${header}.${payload}.${base64Url(signature)}`;
  }

  const discovery = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: `${ISSUER}/jwks`,
  };

  beforeEach(() => {
    process.env.TEST_OIDC_CLIENT_SECRET = "shh";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.TEST_OIDC_CLIENT_SECRET;
  });

  it("builds an authorization URL from OIDC discovery", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(discovery),
    }) as unknown as typeof fetch;

    const provider = new SsoOidcProvider();
    const url = await provider.getAuthorizationUrl(
      CONNECTION,
      "https://freshcup.example.com/callback",
      "state123",
    );

    expect(url.startsWith(`${ISSUER}/authorize?`)).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(parsed.searchParams.get("state")).toBe("state123");
  });

  it("exchanges a code for a verified identity", async () => {
    const idToken = buildIdToken();
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url === `${ISSUER}/.well-known/openid-configuration`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(discovery) });
      }
      if (url === discovery.token_endpoint) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id_token: idToken }) });
      }
      if (url === discovery.jwks_uri) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ keys: [{ ...jwk, kid, alg: "RS256" }] }),
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new SsoOidcProvider();
    const identity = await provider.handleCallback(
      CONNECTION,
      { code: "auth-code" },
      "https://freshcup.example.com/callback",
    );

    expect(identity).toEqual({
      externalId: "user-123",
      email: "user@example.com",
      fullName: "Test User",
      signatureVerified: true,
    });
  });

  it("throws when the callback has no code", async () => {
    const provider = new SsoOidcProvider();
    await expect(
      provider.handleCallback(CONNECTION, {}, "https://freshcup.example.com/callback"),
    ).rejects.toThrow("Missing 'code'");
  });
});
