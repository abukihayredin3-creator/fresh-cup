import { ForbiddenException, Injectable } from "@nestjs/common";
import type { RefreshToken } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface OrgSession {
  id: string;
  userId: string;
  userEmail: string | null;
  userFullName: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Org-admin oversight of active sessions across every user in the
 * organization — distinct from Phase 5's `SessionsController`
 * (`/security/sessions`), which is self-service ("my sessions only").
 * Both read/write the same `RefreshToken` table; a session is still just
 * a refresh token, this only adds the cross-user, org-scoped view an
 * admin needs to force-logout someone during offboarding.
 */
@Injectable()
export class EnterpriseSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrgSessions(organizationId: string): Promise<OrgSession[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { branch: { organizationId } },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    return tokens.map((t) => ({
      id: t.id,
      userId: t.userId,
      userEmail: t.user.email,
      userFullName: t.user.fullName,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }));
  }

  async revokeSession(organizationId: string, sessionId: string): Promise<void> {
    const token = await this.findOrgTokenOrThrow(organizationId, sessionId);
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(organizationId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.branchId) {
      throw new ForbiddenException("User does not belong to your organization");
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: user.branchId } });
    if (branch?.organizationId !== organizationId) {
      throw new ForbiddenException("User does not belong to your organization");
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async findOrgTokenOrThrow(
    organizationId: string,
    sessionId: string,
  ): Promise<RefreshToken> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id: sessionId },
      include: { user: { include: { branch: true } } },
    });
    if (!token || token.user.branch?.organizationId !== organizationId) {
      throw new ForbiddenException("Session not found in your organization");
    }
    return token;
  }
}
