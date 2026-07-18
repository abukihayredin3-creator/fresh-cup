import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { UserRole, type User } from "@prisma/client";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { sha256 } from "../../common/crypto/token.util";
import type { PrismaService } from "../../database/prisma.service";
import { TokenService } from "./token.service";

describe("TokenService", () => {
  let service: TokenService;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };

  const user: User = {
    id: "user-1",
    phone: null,
    email: "admin@test.dev",
    passwordHash: "hash",
    fullName: "Admin",
    role: UserRole.ADMIN,
    branchId: "branch-1",
    locale: "EN",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  beforeEach(() => {
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue("signed.jwt.token") };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          JWT_ACCESS_TTL: "15m",
          REFRESH_TOKEN_TTL_DAYS: 30,
        };
        return values[key];
      }),
    };

    service = new TokenService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  describe("issueTokenPair", () => {
    it("signs an access token and persists a hashed refresh token", async () => {
      const pair = await service.issueTokenPair(user);

      expect(pair.accessToken).toBe("signed.jwt.token");
      expect(pair.expiresIn).toBe(900);
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: user.id,
        role: user.role,
        branchId: user.branchId,
      });

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.tokenHash).toBe(sha256(pair.refreshToken));
      expect(createArgs.data.userId).toBe(user.id);
    });
  });

  describe("rotateRefreshToken", () => {
    it("rejects an unknown token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.rotateRefreshToken("nonexistent")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects a revoked token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user, isActive: true },
      });
      await expect(service.rotateRefreshToken("revoked")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects an expired token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
        user: { ...user, isActive: true },
      });
      await expect(service.rotateRefreshToken("expired")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a token belonging to a deactivated user", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user, isActive: false },
      });
      await expect(service.rotateRefreshToken("valid-but-inactive-user")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("issues a new pair and revokes the old token on success", async () => {
      prisma.refreshToken.findUnique
        .mockResolvedValueOnce({
          id: "rt-1",
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user,
        })
        .mockResolvedValueOnce({ id: "rt-2" });

      const result = await service.rotateRefreshToken("valid-token");

      expect(result.user).toEqual(user);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date), replacedByTokenId: "rt-2" },
      });
    });
  });

  describe("revokeRefreshToken", () => {
    it("marks the matching non-revoked token as revoked", async () => {
      await service.revokeRefreshToken("some-token");
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256("some-token"), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
