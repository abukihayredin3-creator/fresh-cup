import { NotFoundException } from "@nestjs/common";
import { UserRole, type ApiKey } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import { ApiKeysService } from "./api-keys.service";

describe("ApiKeysService", () => {
  let service: ApiKeysService;
  let prisma: {
    apiKey: { findMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

  beforeEach(() => {
    prisma = {
      apiKey: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    service = new ApiKeysService(prisma as unknown as PrismaService);
  });

  describe("create", () => {
    it("returns the raw key only once, alongside its stored hash-based response", async () => {
      prisma.apiKey.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "key-1",
          name: data.name,
          keyHash: data.keyHash,
          keyPrefix: data.keyPrefix,
          createdByUserId: data.createdByUserId,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date(),
        } as ApiKey),
      );

      const result = await service.create(admin, { name: "Integration" });

      expect(result.key).toMatch(/^fck_/);
      expect(result.keyPrefix).toBe(result.key.slice(0, 8));
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Integration",
          keyHash: expect.any(String),
          createdByUserId: "admin-1",
        }),
      });
      // The raw key itself is never sent to the DB — only its hash.
      const createCall = prisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.keyHash).not.toBe(result.key);
    });
  });

  describe("revoke", () => {
    it("throws NotFoundException for an unknown key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.revoke("missing")).rejects.toThrow(NotFoundException);
    });

    it("sets revokedAt on an existing key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: "key-1" });

      await service.revoke("key-1");

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
