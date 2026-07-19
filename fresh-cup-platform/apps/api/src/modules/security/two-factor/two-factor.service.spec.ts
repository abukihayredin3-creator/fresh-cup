import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { generateTotpSecret } from "../../../common/crypto/totp.util";
import type { PrismaService } from "../../../database/prisma.service";
import { TwoFactorService } from "./two-factor.service";

jest.mock("../../../common/crypto/totp.util", () => ({
  generateTotpSecret: jest.fn(() => "GENERATEDSECRET"),
  totpOtpauthUrl: jest.fn(() => "otpauth://totp/mock"),
  verifyTotpCode: jest.fn((secret: string, code: string) => code === "111111"),
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "manager@freshcup.et",
    phone: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    ...overrides,
  } as User;
}

describe("TwoFactorService", () => {
  let service: TwoFactorService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    service = new TwoFactorService(prisma as unknown as PrismaService);
  });

  describe("status", () => {
    it("throws NotFoundException for a missing user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.status("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("enroll", () => {
    it("stores a pending secret without enabling 2FA yet", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());

      const result = await service.enroll("user-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { twoFactorSecret: expect.any(String) },
      });
      expect(result.secret).toBe(generateTotpSecret());
    });
  });

  describe("verify", () => {
    it("rejects verifying before enroll", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorSecret: null }));

      await expect(service.verify("user-1", "111111")).rejects.toThrow(BadRequestException);
    });

    it("rejects an incorrect code", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorSecret: "SECRET" }));

      await expect(service.verify("user-1", "000000")).rejects.toThrow(BadRequestException);
    });

    it("enables 2FA on a correct code", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorSecret: "SECRET" }));

      await service.verify("user-1", "111111");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { twoFactorEnabled: true },
      });
    });
  });

  describe("disable", () => {
    it("rejects disabling when 2FA isn't enabled", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorEnabled: false }));

      await expect(service.disable("user-1", "111111")).rejects.toThrow(BadRequestException);
    });

    it("clears the secret and disables 2FA on a correct code", async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true, twoFactorSecret: "SECRET" }),
      );

      await service.disable("user-1", "111111");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      });
    });
  });
});
