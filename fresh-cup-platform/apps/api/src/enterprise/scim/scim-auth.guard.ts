import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { sha256 } from "../../common/crypto/token.util";
import { PrismaService } from "../../database/prisma.service";
import "../tenancy/request-organization.interface";

/**
 * SCIM clients (the IdP's provisioning connector) authenticate with a
 * static bearer token, not a user JWT — this guard is the SCIM-specific
 * equivalent of JwtAuthGuard, resolving `request.organizationId` from the
 * matching `ScimToken` row instead of a decoded JWT. Every SCIM route is
 * `@Public()` at the global-guard level and relies on this guard instead.
 */
@Injectable()
export class ScimAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing SCIM bearer token");
    }

    const rawToken = header.slice("Bearer ".length);
    const token = await this.prisma.scimToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!token || token.revokedAt) {
      throw new UnauthorizedException("Invalid or revoked SCIM token");
    }

    await this.prisma.scimToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });

    request.organizationId = token.organizationId;
    return true;
  }
}
