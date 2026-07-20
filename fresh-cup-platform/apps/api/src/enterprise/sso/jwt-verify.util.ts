import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

interface Jwk {
  kid: string;
  kty: string;
  [key: string]: unknown;
}

export interface VerifiedIdTokenPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export async function fetchJwks(jwksUri: string): Promise<Jwk[]> {
  const res = await fetch(jwksUri);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUri}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { keys: Jwk[] };
  return body.keys;
}

/**
 * Verifies an OIDC id_token's RS256 signature against the issuer's JWKS
 * using Node's own `crypto` module — `createPublicKey({ format: "jwk" })`
 * imports the JWK directly, so this never hand-rolls RSA key construction
 * or signature math, only the well-defined "decode header, find key by
 * kid, verify over header.payload" JWT verification steps. Only RS256 is
 * handled — every enterprise OIDC IdP this platform targets (Google
 * Workspace, Microsoft Entra ID, Okta) defaults to RS256; ES256 tokens
 * are rejected rather than silently unverified.
 */
export async function verifyIdToken(
  idToken: string,
  jwksUri: string,
  expectedIssuer: string,
  expectedAudience: string,
): Promise<VerifiedIdTokenPayload> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed id_token");
  }
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as {
    kid: string;
    alg: string;
  };
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported id_token algorithm '${header.alg}' — only RS256 is verified`);
  }

  const payload = JSON.parse(
    base64UrlDecode(payloadB64).toString("utf8"),
  ) as VerifiedIdTokenPayload;

  const keys = await fetchJwks(jwksUri);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error(`No JWKS key found for kid='${header.kid}'`);
  }

  const publicKey = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const valid = verifier.verify(publicKey, base64UrlDecode(signatureB64));
  if (!valid) {
    throw new Error("id_token signature verification failed");
  }

  if (payload.iss !== expectedIssuer) {
    throw new Error(`id_token issuer mismatch: expected '${expectedIssuer}', got '${payload.iss}'`);
  }
  if (payload.aud !== expectedAudience) {
    throw new Error("id_token audience mismatch");
  }
  if (payload.exp * 1000 < Date.now()) {
    throw new Error("id_token has expired");
  }

  return payload;
}
