import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { generateOpaqueToken, sha256 } from "../../common/crypto/token.util";
import { PrismaService } from "../../database/prisma.service";

export interface AccessTokenPayload {
  sub: string;
  role: User["role"];
  branchId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken, expiresIn: this.accessTokenTtlSeconds() };
  }

  /** Rotates on every use: the old token is revoked the instant a new one is issued. */
  async rotateRefreshToken(rawToken: string): Promise<TokenPair & { user: User }> {
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt < new Date() ||
      !existing.user.isActive
    ) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const pair = await this.issueTokenPair(existing.user);
    const newTokenHash = sha256(pair.refreshToken);
    const newToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenId: newToken?.id },
    });

    return { ...pair, user: existing.user };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = sha256(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: User): string {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, branchId: user.branchId };
    return this.jwt.sign(payload);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = generateOpaqueToken();
    const ttlDays = this.config.get("REFRESH_TOKEN_TTL_DAYS", { infer: true });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60_000),
      },
    });

    return raw;
  }

  private accessTokenTtlSeconds(): number {
    const ttl = this.config.get("JWT_ACCESS_TTL", { infer: true });
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) {
      return 900;
    }
    const [, amountStr, unit] = match;
    const amount = Number(amountStr);
    const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[unit as "s" | "m" | "h" | "d"];
    return amount * unitSeconds;
  }
}
