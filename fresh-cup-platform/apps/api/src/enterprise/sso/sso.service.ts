import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma, SsoConnection, User } from "@prisma/client";
import { SsoProviderType, UserRole } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { PrismaService } from "../../database/prisma.service";
import type { TokenPair } from "../../modules/auth/token.service";
import { TokenService } from "../../modules/auth/token.service";
import { EnterpriseAuditService } from "../audit/enterprise-audit.service";
import type { CreateSsoConnectionDto } from "./dto/create-sso-connection.dto";
import type { SsoOidcCallbackDto, SsoSamlCallbackDto } from "./dto/sso-callback.dto";
import { createSsoProvider } from "./sso-provider.factory";
import type { SsoIdentity } from "./sso-provider.interface";
import { SsoSamlProvider } from "./providers/saml.sso-provider";
import { createSsoState, verifySsoState } from "./state.util";

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: EnterpriseAuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  listConnections(organizationId: string): Promise<SsoConnection[]> {
    return this.prisma.ssoConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  createConnection(organizationId: string, dto: CreateSsoConnectionDto): Promise<SsoConnection> {
    return this.prisma.ssoConnection.create({
      data: { organizationId, ...dto, config: dto.config as Prisma.InputJsonValue },
    });
  }

  async initiate(
    organizationId: string,
    connectionId: string,
    redirectUri: string,
  ): Promise<{ authorizationUrl: string }> {
    const connection = await this.findConnectionOrThrow(organizationId, connectionId);
    const provider = createSsoProvider(connection.provider);
    const state = createSsoState(
      this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      connectionId,
    );
    const authorizationUrl = await provider.getAuthorizationUrl(connection, redirectUri, state);
    return { authorizationUrl };
  }

  async handleOidcCallback(
    organizationId: string,
    connectionId: string,
    dto: SsoOidcCallbackDto,
  ): Promise<TokenPair> {
    const connection = await this.findConnectionOrThrow(organizationId, connectionId);
    if (connection.provider === SsoProviderType.SAML) {
      throw new ForbiddenException("This connection is a SAML connection, not OIDC");
    }

    const secret = this.config.get("JWT_ACCESS_SECRET", { infer: true });
    if (!verifySsoState(secret, dto.state, connectionId)) {
      throw new ForbiddenException("Invalid or expired SSO state");
    }

    const provider = createSsoProvider(connection.provider);
    const identity = await provider.handleCallback(connection, { code: dto.code }, dto.redirectUri);
    return this.completeLogin(organizationId, connection, identity);
  }

  async handleSamlCallback(
    organizationId: string,
    connectionId: string,
    dto: SsoSamlCallbackDto,
  ): Promise<TokenPair> {
    const connection = await this.findConnectionOrThrow(organizationId, connectionId);
    if (connection.provider !== SsoProviderType.SAML) {
      throw new ForbiddenException("This connection is not a SAML connection");
    }

    const identity = new SsoSamlProvider().parseResponse(dto.samlResponse);
    if (!identity.signatureVerified) {
      const allowUnverified = this.config.get("ENTERPRISE_SSO_SAML_ALLOW_UNVERIFIED", {
        infer: true,
      });
      if (!allowUnverified) {
        throw new ForbiddenException(
          "SAML Response signature verification is not implemented in this platform (see " +
            "SsoSamlProvider's docblock) — set ENTERPRISE_SSO_SAML_ALLOW_UNVERIFIED=true to " +
            "proceed anyway. Do not set this in production without a security-reviewed SAML library.",
        );
      }
    }

    return this.completeLogin(organizationId, connection, identity);
  }

  private async completeLogin(
    organizationId: string,
    connection: SsoConnection,
    identity: SsoIdentity,
  ): Promise<TokenPair> {
    const user = await this.findOrProvisionUser(organizationId, identity);
    await this.auditService.record(
      organizationId,
      "SSO_LOGIN",
      { connectionId: connection.id, provider: connection.provider, email: identity.email },
      user.id,
    );
    return this.tokenService.issueTokenPair(user);
  }

  private async findOrProvisionUser(organizationId: string, identity: SsoIdentity): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email: identity.email } });
    if (existing) {
      if (existing.branchId) {
        const branch = await this.prisma.branch.findUnique({ where: { id: existing.branchId } });
        if (branch?.organizationId !== organizationId) {
          throw new ForbiddenException("This identity does not belong to your organization");
        }
      }
      return existing;
    }

    const defaultBranch = await this.prisma.branch.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    if (!defaultBranch) {
      throw new ConflictException("Organization has no branch to provision SSO users into");
    }

    return this.prisma.user.create({
      data: {
        email: identity.email,
        fullName: identity.fullName,
        role: UserRole.STAFF,
        branchId: defaultBranch.id,
      },
    });
  }

  private async findConnectionOrThrow(
    organizationId: string,
    connectionId: string,
  ): Promise<SsoConnection> {
    const connection = await this.prisma.ssoConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.organizationId !== organizationId || !connection.isEnabled) {
      throw new NotFoundException("SSO connection not found");
    }
    return connection;
  }
}
