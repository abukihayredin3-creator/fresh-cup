import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { SsoProviderType, UserRole } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { TokenService } from "../../modules/auth/token.service";
import type { EnterpriseAuditService } from "../audit/enterprise-audit.service";
import { SsoService } from "./sso.service";
import { createSsoState } from "./state.util";

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

const SECRET = "test-jwt-secret";

const OIDC_CONNECTION = {
  id: "conn-1",
  organizationId: "org-1",
  provider: SsoProviderType.GENERIC_OIDC,
  isEnabled: true,
  config: { issuer: "https://idp.example.com", clientId: "client-abc" },
  clientSecretEnvVar: null,
};

describe("SsoService", () => {
  function makeService(overrides: {
    connection?: unknown;
    existingUser?: unknown;
    defaultBranch?: unknown;
  }) {
    const prisma = {
      ssoConnection: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(overrides.connection ?? OIDC_CONNECTION),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "conn-2", ...data })),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(overrides.existingUser ?? null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "user-new", ...data })),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue({ id: "b1", organizationId: "org-1" }),
        findFirst: jest.fn().mockResolvedValue(overrides.defaultBranch ?? { id: "b1" }),
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
        if (key === "JWT_ACCESS_SECRET") return SECRET;
        if (key === "ENTERPRISE_SSO_SAML_ALLOW_UNVERIFIED") return false;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const service = new SsoService(prisma, tokenService, auditService, config);
    return { service, prisma, tokenService, auditService, config };
  }

  it("throws NotFoundException for a connection in a different organization", async () => {
    const { service } = makeService({
      connection: { ...OIDC_CONNECTION, organizationId: "org-2" },
    });
    await expect(service.initiate("org-1", "conn-1", "https://redirect")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects an OIDC callback with an invalid state", async () => {
    const { service } = makeService({});
    await expect(
      service.handleOidcCallback("org-1", "conn-1", {
        code: "abc",
        state: "bogus-state",
        redirectUri: "https://redirect",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects a SAML callback for an OIDC connection", async () => {
    const { service } = makeService({});
    await expect(
      service.handleSamlCallback("org-1", "conn-1", { samlResponse: "abc" }),
    ).rejects.toThrow("not a SAML connection");
  });

  it("logs into an existing user in the same organization", async () => {
    const existingUser = { id: "user-1", branchId: "b1" };
    const { service, prisma, tokenService, auditService } = makeService({ existingUser });

    // Bypass the OIDC network calls by testing findOrProvisionUser indirectly via completeLogin.
    const completeLogin = (
      service as unknown as {
        completeLogin: (
          organizationId: string,
          connection: unknown,
          identity: unknown,
        ) => Promise<unknown>;
      }
    ).completeLogin.bind(service);

    const result = await completeLogin("org-1", OIDC_CONNECTION, {
      externalId: "ext-1",
      email: "user@example.com",
      fullName: "Test User",
      signatureVerified: true,
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "user@example.com" } });
    expect(tokenService.issueTokenPair).toHaveBeenCalledWith(existingUser);
    expect(auditService.record).toHaveBeenCalledWith(
      "org-1",
      "SSO_LOGIN",
      expect.objectContaining({ connectionId: "conn-1" }),
      "user-1",
    );
    expect(result).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 900 });
  });

  it("refuses to log in a user whose existing branch belongs to a different organization", async () => {
    const existingUser = { id: "user-1", branchId: "b1" };
    const { service, prisma } = makeService({ existingUser });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-9",
    });

    const completeLogin = (
      service as unknown as {
        completeLogin: (
          organizationId: string,
          connection: unknown,
          identity: unknown,
        ) => Promise<unknown>;
      }
    ).completeLogin.bind(service);

    await expect(
      completeLogin("org-1", OIDC_CONNECTION, {
        externalId: "ext-1",
        email: "user@example.com",
        fullName: "Test User",
        signatureVerified: true,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("provisions a new user into the organization's oldest branch when none exists", async () => {
    const { service, prisma } = makeService({
      existingUser: null,
      defaultBranch: { id: "b-oldest" },
    });

    const completeLogin = (
      service as unknown as {
        completeLogin: (
          organizationId: string,
          connection: unknown,
          identity: unknown,
        ) => Promise<unknown>;
      }
    ).completeLogin.bind(service);

    await completeLogin("org-1", OIDC_CONNECTION, {
      externalId: "ext-1",
      email: "new@example.com",
      fullName: "New User",
      signatureVerified: true,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        role: UserRole.STAFF,
        branchId: "b-oldest",
      }),
    });
  });

  it("refuses a SAML login when signatureVerified is false and unverified isn't allowed", async () => {
    const samlConnection = { ...OIDC_CONNECTION, provider: SsoProviderType.SAML };
    const { service } = makeService({ connection: samlConnection });

    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Assertion><saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>`;
    const samlResponse = Buffer.from(xml, "utf8").toString("base64");

    await expect(service.handleSamlCallback("org-1", "conn-1", { samlResponse })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows an unverified SAML login when the env flag is set", async () => {
    const samlConnection = { ...OIDC_CONNECTION, provider: SsoProviderType.SAML };
    const { service, config, tokenService } = makeService({
      connection: samlConnection,
      existingUser: { id: "user-1", branchId: "b1" },
    });
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "ENTERPRISE_SSO_SAML_ALLOW_UNVERIFIED") return true;
      return undefined;
    });

    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Assertion><saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>`;
    const samlResponse = Buffer.from(xml, "utf8").toString("base64");

    const result = await service.handleSamlCallback("org-1", "conn-1", { samlResponse });
    expect(tokenService.issueTokenPair).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 900 });
  });

  it("completes a full OIDC login end to end with a valid state and a real signed id_token", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    const kid = "key-1";
    const issuer = (OIDC_CONNECTION.config as { issuer: string }).issuer;
    const clientId = (OIDC_CONNECTION.config as { clientId: string }).clientId;

    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
    const payload = base64Url(
      JSON.stringify({
        sub: "ext-1",
        iss: issuer,
        aud: clientId,
        email: "user@example.com",
        name: "Test User",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    const signature = cryptoSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey);
    const idToken = `${header}.${payload}.${base64Url(signature)}`;

    const discovery = {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
    };
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === `${issuer}/.well-known/openid-configuration`) {
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
    }) as unknown as typeof fetch;

    const { service, tokenService, auditService } = makeService({
      existingUser: { id: "user-1", branchId: "b1" },
    });

    const state = createSsoState(SECRET, "conn-1");
    const result = await service.handleOidcCallback("org-1", "conn-1", {
      code: "auth-code",
      state,
      redirectUri: "https://freshcup.example.com/callback",
    });

    expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      "org-1",
      "SSO_LOGIN",
      expect.objectContaining({ email: "user@example.com" }),
      "user-1",
    );
    expect(result).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 900 });

    jest.restoreAllMocks();
  });
});
