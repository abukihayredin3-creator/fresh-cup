import { createHash, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../database/prisma.service";
import type { TokenService } from "../../modules/auth/token.service";
import type { EnterpriseAuditService } from "../audit/enterprise-audit.service";
import { WebAuthnService } from "./webauthn.service";

const RP_ID = "admin.freshcup.example.com";
const ORIGIN = `https://${RP_ID}`;

// --- minimal CBOR encoders, test-fixture-only (mirror the decoder's shapes) ---
function cborHeader(majorType: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(majorType << 5) | length]);
  if (length < 256) return Buffer.from([(majorType << 5) | 24, length]);
  throw new Error("test helper: length too large");
}
function cborUint(n: number): Buffer {
  return cborHeader(0, n);
}
function cborNegInt(n: number): Buffer {
  return cborHeader(1, -1 - n);
}
function cborBytes(b: Buffer): Buffer {
  return Buffer.concat([cborHeader(2, b.length), b]);
}
function cborText(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  return Buffer.concat([cborHeader(3, b.length), b]);
}
function cborMapHeader(pairs: number): Buffer {
  return cborHeader(5, pairs);
}

function encodeCoseKeyP256(x: Buffer, y: Buffer): Buffer {
  return Buffer.concat([
    cborMapHeader(5),
    cborUint(1),
    cborUint(2),
    cborUint(3),
    cborNegInt(-7),
    cborNegInt(-1),
    cborUint(1),
    cborNegInt(-2),
    cborBytes(x),
    cborNegInt(-3),
    cborBytes(y),
  ]);
}

function encodeAttestationObject(authData: Buffer): Buffer {
  return Buffer.concat([
    cborMapHeader(3),
    cborText("fmt"),
    cborText("none"),
    cborText("attStmt"),
    cborMapHeader(0),
    cborText("authData"),
    cborBytes(authData),
  ]);
}

function buildRegistrationAuthenticatorData(
  signCount: number,
  credentialId: Buffer,
  coseKey: Buffer,
): Buffer {
  const rpIdHash = createHash("sha256").update(RP_ID).digest();
  const flags = Buffer.from([0x41]); // UP + AT
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(signCount);
  const aaguid = Buffer.alloc(16);
  const credIdLen = Buffer.alloc(2);
  credIdLen.writeUInt16BE(credentialId.length);
  return Buffer.concat([rpIdHash, flags, signCountBuf, aaguid, credIdLen, credentialId, coseKey]);
}

function buildAssertionAuthenticatorData(signCount: number): Buffer {
  const rpIdHash = createHash("sha256").update(RP_ID).digest();
  const flags = Buffer.from([0x01]); // UP only
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(signCount);
  return Buffer.concat([rpIdHash, flags, signCountBuf]);
}

describe("WebAuthnService", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  const credentialId = Buffer.from("test-credential-id-bytes");

  function makeService() {
    const challengeStore = new Map<
      string,
      { id: string; userId: string; purpose: string; challenge: string; expiresAt: Date }
    >();
    let challengeCounter = 0;
    let storedCredential: {
      id: string;
      userId: string;
      credentialId: string;
      publicKeyCose: string;
      signCount: number;
    } | null = null;

    const prisma = {
      webAuthnChallenge: {
        create: jest.fn().mockImplementation(({ data }) => {
          const id = `chal-${++challengeCounter}`;
          challengeStore.set(id, { id, ...data });
          return Promise.resolve({ id, ...data });
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          for (const c of challengeStore.values()) {
            if (
              c.userId === where.userId &&
              c.purpose === where.purpose &&
              c.challenge === where.challenge
            ) {
              return Promise.resolve(c);
            }
          }
          return Promise.resolve(null);
        }),
        delete: jest.fn().mockImplementation(({ where }) => {
          challengeStore.delete(where.id);
          return Promise.resolve(undefined);
        }),
      },
      webAuthnCredential: {
        create: jest.fn().mockImplementation(({ data }) => {
          storedCredential = { id: "cred-1", ...data };
          return Promise.resolve(storedCredential);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (storedCredential && where.credentialId === storedCredential.credentialId) {
            return Promise.resolve(storedCredential);
          }
          if (storedCredential && where.id === storedCredential.id) {
            return Promise.resolve(storedCredential);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          storedCredential = { ...storedCredential!, ...data };
          return Promise.resolve(storedCredential);
        }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "user-1", email: "u@example.com" }),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const tokenService = {
      issueTokenPair: jest
        .fn()
        .mockResolvedValue({ accessToken: "at", refreshToken: "rt", expiresIn: 900 }),
    } as unknown as jest.Mocked<TokenService>;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EnterpriseAuditService>;

    const config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "ENTERPRISE_WEBAUTHN_RP_ID") return RP_ID;
        if (key === "ENTERPRISE_WEBAUTHN_ORIGIN") return ORIGIN;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    return {
      service: new WebAuthnService(prisma, tokenService, auditService, config),
      prisma,
      tokenService,
      auditService,
    };
  }

  it("registers a real credential end to end and verifies a real ES256 assertion", async () => {
    const { service, tokenService } = makeService();

    const regChallenge = await service.generateRegistrationChallenge("user-1");
    const regClientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.create",
        challenge: regChallenge.challenge,
        origin: ORIGIN,
      }),
      "utf8",
    ).toString("base64url");

    const coseKey = encodeCoseKeyP256(x, y);
    const regAuthData = buildRegistrationAuthenticatorData(0, credentialId, coseKey);
    const attestationObject = encodeAttestationObject(regAuthData).toString("base64url");

    const credential = await service.verifyRegistration("org-1", "user-1", {
      clientDataJSON: regClientData,
      attestationObject,
      deviceName: "YubiKey 5",
    });
    expect(credential.credentialId).toBe(credentialId.toString("base64url"));

    const assertChallenge = await service.generateAssertionChallenge("user-1");
    const assertClientDataBuf = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge: assertChallenge.challenge,
        origin: ORIGIN,
      }),
      "utf8",
    );
    const assertClientData = assertClientDataBuf.toString("base64url");
    const assertAuthData = buildAssertionAuthenticatorData(1);
    const clientDataHash = createHash("sha256").update(assertClientDataBuf).digest();
    const signedData = Buffer.concat([assertAuthData, clientDataHash]);
    const signature = cryptoSign("sha256", signedData, privateKey);

    const result = await service.verifyAssertion("org-1", "user-1", {
      credentialId: credentialId.toString("base64url"),
      clientDataJSON: assertClientData,
      authenticatorData: assertAuthData.toString("base64url"),
      signature: signature.toString("base64url"),
    });

    expect(tokenService.issueTokenPair).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 900 });
  });

  it("rejects an assertion with a tampered signature", async () => {
    const { service } = makeService();

    const regChallenge = await service.generateRegistrationChallenge("user-1");
    const regClientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.create",
        challenge: regChallenge.challenge,
        origin: ORIGIN,
      }),
      "utf8",
    ).toString("base64url");
    const coseKey = encodeCoseKeyP256(x, y);
    const regAuthData = buildRegistrationAuthenticatorData(0, credentialId, coseKey);
    await service.verifyRegistration("org-1", "user-1", {
      clientDataJSON: regClientData,
      attestationObject: encodeAttestationObject(regAuthData).toString("base64url"),
    });

    const assertChallenge = await service.generateAssertionChallenge("user-1");
    const assertClientDataBuf = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge: assertChallenge.challenge,
        origin: ORIGIN,
      }),
      "utf8",
    );
    const assertAuthData = buildAssertionAuthenticatorData(1);

    // Forged signature — random bytes, never produced by the real private key.
    const forgedSignature = Buffer.alloc(70, 1);

    await expect(
      service.verifyAssertion("org-1", "user-1", {
        credentialId: credentialId.toString("base64url"),
        clientDataJSON: assertClientDataBuf.toString("base64url"),
        authenticatorData: assertAuthData.toString("base64url"),
        signature: forgedSignature.toString("base64url"),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects a challenge reused a second time", async () => {
    const { service } = makeService();
    const regChallenge = await service.generateRegistrationChallenge("user-1");
    const clientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.create",
        challenge: regChallenge.challenge,
        origin: ORIGIN,
      }),
      "utf8",
    ).toString("base64url");
    const coseKey = encodeCoseKeyP256(x, y);
    const authData = buildRegistrationAuthenticatorData(0, credentialId, coseKey);
    const attestationObject = encodeAttestationObject(authData).toString("base64url");

    await service.verifyRegistration("org-1", "user-1", {
      clientDataJSON: clientData,
      attestationObject,
    });

    await expect(
      service.verifyRegistration("org-1", "user-1", {
        clientDataJSON: clientData,
        attestationObject,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects a clientData origin mismatch", async () => {
    const { service } = makeService();
    const regChallenge = await service.generateRegistrationChallenge("user-1");
    const clientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.create",
        challenge: regChallenge.challenge,
        origin: "https://evil.example.com",
      }),
      "utf8",
    ).toString("base64url");
    const coseKey = encodeCoseKeyP256(x, y);
    const authData = buildRegistrationAuthenticatorData(0, credentialId, coseKey);

    await expect(
      service.verifyRegistration("org-1", "user-1", {
        clientDataJSON: clientData,
        attestationObject: encodeAttestationObject(authData).toString("base64url"),
      }),
    ).rejects.toThrow("origin mismatch");
  });
});
