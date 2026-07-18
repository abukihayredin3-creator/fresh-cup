import { ForbiddenException } from "@nestjs/common";
import { UserRole, type User } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe("findOrCreateCustomerByPhone", () => {
    it("returns the existing user when found", async () => {
      const existing = { id: "u1", phone: "+251911111111" } as User;
      prisma.user.findUnique.mockResolvedValue(existing);

      const result = await service.findOrCreateCustomerByPhone("+251911111111");

      expect(result).toBe(existing);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("creates a new customer when no user exists for the phone", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "u2",
        phone: "+251922222222",
        role: UserRole.CUSTOMER,
      });

      const result = await service.findOrCreateCustomerByPhone("+251922222222");

      expect(result.role).toBe(UserRole.CUSTOMER);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { phone: "+251922222222", fullName: "Fresh Cup Customer", role: UserRole.CUSTOMER },
      });
    });
  });

  describe("listUsers", () => {
    it("forces a manager's query to their own branch regardless of the requested filter", async () => {
      const manager: RequestUser = { id: "m1", role: UserRole.MANAGER, branchId: "branch-1" };

      await service.listUsers(manager, { branchId: "branch-2", cursor: undefined, limit: 20 });

      const whereArg = prisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.branchId).toBe("branch-1");
    });

    it("lets an admin filter by any branch", async () => {
      const admin: RequestUser = { id: "a1", role: UserRole.ADMIN, branchId: null };

      await service.listUsers(admin, { branchId: "branch-2", cursor: undefined, limit: 20 });

      const whereArg = prisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.branchId).toBe("branch-2");
    });
  });

  describe("adminUpdateUser", () => {
    const targetInBranch1 = { id: "t1", branchId: "branch-1" } as User;

    it("allows a manager to update a user in their own branch", async () => {
      prisma.user.findUnique.mockResolvedValue(targetInBranch1);
      prisma.user.update.mockResolvedValue(targetInBranch1);
      const manager: RequestUser = { id: "m1", role: UserRole.MANAGER, branchId: "branch-1" };

      await expect(
        service.adminUpdateUser(manager, targetInBranch1.id, { fullName: "New Name" }),
      ).resolves.toBeDefined();
    });

    it("blocks a manager from updating a user in a different branch", async () => {
      prisma.user.findUnique.mockResolvedValue(targetInBranch1);
      const manager: RequestUser = { id: "m1", role: UserRole.MANAGER, branchId: "branch-2" };

      await expect(
        service.adminUpdateUser(manager, targetInBranch1.id, { fullName: "New Name" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("blocks a manager from changing a user's role even within their own branch", async () => {
      prisma.user.findUnique.mockResolvedValue(targetInBranch1);
      const manager: RequestUser = { id: "m1", role: UserRole.MANAGER, branchId: "branch-1" };

      await expect(
        service.adminUpdateUser(manager, targetInBranch1.id, { role: UserRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows an admin to change a user's role", async () => {
      prisma.user.findUnique.mockResolvedValue(targetInBranch1);
      prisma.user.update.mockResolvedValue({ ...targetInBranch1, role: UserRole.MANAGER });
      const admin: RequestUser = { id: "a1", role: UserRole.ADMIN, branchId: null };

      await expect(
        service.adminUpdateUser(admin, targetInBranch1.id, { role: UserRole.MANAGER }),
      ).resolves.toBeDefined();
    });
  });
});
