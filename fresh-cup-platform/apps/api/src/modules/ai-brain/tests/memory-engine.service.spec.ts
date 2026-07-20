import type { AiMemory } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { MemoryEngineService } from "../services/memory-engine.service";

describe("MemoryEngineService", () => {
  let service: MemoryEngineService;
  let prisma: {
    aiMemory: { create: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      aiMemory: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new MemoryEngineService(prisma as unknown as PrismaService);
  });

  describe("record", () => {
    it("stores an event scoped to the organization, defaulting importance to 0.5", async () => {
      prisma.aiMemory.create.mockResolvedValue({ id: "mem-1" } as AiMemory);

      await service.record("org-1", {
        memoryType: "SALES_DROP",
        data: { branch: "Fresh Cup Merkato", context: { revenue: -15, reason: "rain" } },
      });

      expect(prisma.aiMemory.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          branchId: undefined,
          memoryType: "SALES_DROP",
          data: { branch: "Fresh Cup Merkato", context: { revenue: -15, reason: "rain" } },
          importance: 0.5,
        },
      });
    });

    it("carries an explicit importance score and branch scope through", async () => {
      prisma.aiMemory.create.mockResolvedValue({ id: "mem-2" } as AiMemory);

      await service.record("org-1", {
        branchId: "branch-1",
        memoryType: "OBSERVATION",
        data: { note: "weekend spike" },
        importance: 0.9,
      });

      const arg = prisma.aiMemory.create.mock.calls[0][0].data;
      expect(arg.branchId).toBe("branch-1");
      expect(arg.importance).toBe(0.9);
    });
  });

  describe("recall", () => {
    it("scopes the query to the organization and applies optional filters", async () => {
      await service.recall("org-1", {
        branchId: "branch-1",
        memoryType: "SALES_DROP",
        minImportance: 0.7,
        limit: 20,
      });

      const whereArg = prisma.aiMemory.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({
        organizationId: "org-1",
        branchId: "branch-1",
        memoryType: "SALES_DROP",
        importance: { gte: 0.7 },
      });
    });

    it("never leaks another organization's memories through an unscoped query", async () => {
      await service.recall("org-1", { limit: 20 });

      const whereArg = prisma.aiMemory.findMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe("org-1");
      expect(whereArg.branchId).toBeUndefined();
    });
  });

  describe("mostImportant", () => {
    it("orders by importance then recency", async () => {
      await service.mostImportant("org-1");

      const args = prisma.aiMemory.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ organizationId: "org-1" });
      expect(args.orderBy).toEqual([{ importance: "desc" }, { createdAt: "desc" }]);
    });
  });

  describe("findByType", () => {
    it("filters by memoryType within the organization", async () => {
      await service.findByType("org-1", "OBSERVATION", "branch-2");

      const whereArg = prisma.aiMemory.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({
        organizationId: "org-1",
        memoryType: "OBSERVATION",
        branchId: "branch-2",
      });
    });
  });
});
