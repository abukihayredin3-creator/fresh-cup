import { Injectable } from "@nestjs/common";
import type { RefreshToken } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { SessionResponseDto } from "./dto/session-response.dto";

/** "Sessions" are active (non-revoked, non-expired) refresh tokens — one per logged-in device. */
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(userId: string, id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  toResponse(token: RefreshToken): SessionResponseDto {
    return { id: token.id, createdAt: token.createdAt, expiresAt: token.expiresAt };
  }
}
