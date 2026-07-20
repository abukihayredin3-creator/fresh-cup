import { createHash, randomBytes, verify as cryptoVerify } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WebAuthnCredential } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { PrismaService } from "../../database/prisma.service";
import type { TokenPair } from "../../modules/auth/token.service";
import { TokenService } from "../../modules/auth/token.service";
import { EnterpriseAuditService } from "../audit/enterprise-audit.service";
import { decodeCbor, type CborValue } from "./cbor.util";
import { parseAuthenticatorData } from "./authenticator-data.util";
import { parseCoseKey } from "./cose-key.util";
import type { VerifyWebAuthnAssertionDto } from "./dto/webauthn-assertion.dto";
import type { VerifyWebAuthnRegistrationDto } from "./dto/webauthn-registration.dto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const REGISTRATION_PURPOSE = "registration";
const ASSERTION_PURPOSE = "assertion";

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}

/**
 * WebAuthn hardware security keys — real cryptographic verification, not
 * a stub. `cbor.util.ts`/`cose-key.util.ts`/`authenticator-data.util.ts`
 * decode the authenticator's binary structures with Node's own `crypto`
 * primitives (no invented crypto, no new dependency), so both
 * registration and assertion genuinely verify what the browser reports.
 * The one thing this service does NOT verify is the attestation
 * statement (the certificate chain proving a credential came from a
 * specific vendor's hardware) — that's a separate, optional trust layer
 * most WebAuthn deployments skip in favor of trusting the browser/OS
 * platform authenticator, and this platform follows that same common
 * practice rather than adding FIDO Metadata Service integration.
 */
@Injectable()
export class WebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: EnterpriseAuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async generateRegistrationChallenge(
    userId: string,
  ): Promise<{ challenge: string; rpId: string }> {
    const rpId = this.requireRpId();
    const challenge = randomBytes(32).toString("base64url");
    await this.prisma.webAuthnChallenge.create({
      data: {
        userId,
        challenge,
        purpose: REGISTRATION_PURPOSE,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return { challenge, rpId };
  }

  async verifyRegistration(
    organizationId: string,
    userId: string,
    dto: VerifyWebAuthnRegistrationDto,
  ): Promise<WebAuthnCredential> {
    await this.consumeChallenge(
      userId,
      REGISTRATION_PURPOSE,
      dto.clientDataJSON,
      "webauthn.create",
    );

    const attestationObject = Buffer.from(dto.attestationObject, "base64url");
    const { value } = decodeCbor(attestationObject);
    const map = value as Map<string, CborValue>;
    const authData = map.get("authData") as Buffer;

    const parsed = parseAuthenticatorData(authData);
    this.verifyRpIdHash(parsed.rpIdHash);

    if (!parsed.credentialId || !parsed.credentialPublicKey) {
      throw new ForbiddenException("Attestation object did not include credential data");
    }

    const credential = await this.prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: parsed.credentialId.toString("base64url"),
        publicKeyCose: parsed.credentialPublicKey.toString("base64"),
        signCount: parsed.signCount,
        deviceName: dto.deviceName,
      },
    });
    await this.auditService.record(
      organizationId,
      "WEBAUTHN_REGISTERED",
      { credentialId: credential.credentialId, deviceName: dto.deviceName },
      userId,
    );
    return credential;
  }

  async generateAssertionChallenge(userId: string): Promise<{ challenge: string; rpId: string }> {
    const rpId = this.requireRpId();
    const challenge = randomBytes(32).toString("base64url");
    await this.prisma.webAuthnChallenge.create({
      data: {
        userId,
        challenge,
        purpose: ASSERTION_PURPOSE,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return { challenge, rpId };
  }

  async verifyAssertion(
    organizationId: string,
    userId: string,
    dto: VerifyWebAuthnAssertionDto,
  ): Promise<TokenPair> {
    await this.consumeChallenge(userId, ASSERTION_PURPOSE, dto.clientDataJSON, "webauthn.get");

    const credential = await this.prisma.webAuthnCredential.findUnique({
      where: { credentialId: dto.credentialId },
    });
    if (!credential || credential.userId !== userId) {
      throw new NotFoundException("WebAuthn credential not found");
    }

    const authenticatorData = Buffer.from(dto.authenticatorData, "base64url");
    const parsed = parseAuthenticatorData(authenticatorData);
    this.verifyRpIdHash(parsed.rpIdHash);

    // signCount === 0 is a documented exception: some authenticators
    // (notably platform authenticators using resident keys) never
    // implement a counter and always report 0 — strict monotonic
    // increase is only enforced once a nonzero counter has been seen.
    if (parsed.signCount !== 0 && parsed.signCount <= credential.signCount) {
      throw new ForbiddenException(
        "WebAuthn signature counter did not increase — possible cloned authenticator",
      );
    }

    const clientDataHash = createHash("sha256")
      .update(Buffer.from(dto.clientDataJSON, "base64url"))
      .digest();
    const signedData = Buffer.concat([authenticatorData, clientDataHash]);
    const signature = Buffer.from(dto.signature, "base64url");

    const { publicKey } = parseCoseKey(Buffer.from(credential.publicKeyCose, "base64"));
    const valid = cryptoVerify("sha256", signedData, publicKey, signature);
    if (!valid) {
      throw new ForbiddenException("WebAuthn assertion signature verification failed");
    }

    await this.prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: { signCount: parsed.signCount, lastUsedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.auditService.record(
      organizationId,
      "WEBAUTHN_ASSERTION",
      { credentialId: credential.credentialId },
      userId,
    );
    return this.tokenService.issueTokenPair(user);
  }

  listCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return this.prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteCredential(userId: string, credentialDbId: string): Promise<void> {
    const credential = await this.prisma.webAuthnCredential.findUnique({
      where: { id: credentialDbId },
    });
    if (!credential || credential.userId !== userId) {
      throw new NotFoundException("WebAuthn credential not found");
    }
    await this.prisma.webAuthnCredential.delete({ where: { id: credentialDbId } });
  }

  private async consumeChallenge(
    userId: string,
    purpose: string,
    clientDataJSONBase64: string,
    expectedType: string,
  ): Promise<void> {
    const clientData = JSON.parse(
      Buffer.from(clientDataJSONBase64, "base64url").toString("utf8"),
    ) as ClientData;

    if (clientData.type !== expectedType) {
      throw new ForbiddenException(`Unexpected WebAuthn clientData.type: ${clientData.type}`);
    }

    const expectedOrigin = this.requireOrigin();
    if (clientData.origin !== expectedOrigin) {
      throw new ForbiddenException(
        `WebAuthn origin mismatch: expected '${expectedOrigin}', got '${clientData.origin}'`,
      );
    }

    const stored = await this.prisma.webAuthnChallenge.findFirst({
      where: { userId, purpose, challenge: clientData.challenge },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new ForbiddenException("WebAuthn challenge is missing, already used, or expired");
    }
    await this.prisma.webAuthnChallenge.delete({ where: { id: stored.id } });
  }

  private verifyRpIdHash(rpIdHash: Buffer): void {
    const rpId = this.requireRpId();
    const expected = createHash("sha256").update(rpId).digest();
    if (!expected.equals(rpIdHash)) {
      throw new ForbiddenException("WebAuthn RP ID hash mismatch");
    }
  }

  private requireRpId(): string {
    const rpId = this.config.get("ENTERPRISE_WEBAUTHN_RP_ID", { infer: true });
    if (!rpId) {
      throw new ForbiddenException("WebAuthn is not configured (ENTERPRISE_WEBAUTHN_RP_ID unset)");
    }
    return rpId;
  }

  private requireOrigin(): string {
    const origin = this.config.get("ENTERPRISE_WEBAUTHN_ORIGIN", { infer: true });
    if (origin) return origin;
    return `https://${this.requireRpId()}`;
  }
}
