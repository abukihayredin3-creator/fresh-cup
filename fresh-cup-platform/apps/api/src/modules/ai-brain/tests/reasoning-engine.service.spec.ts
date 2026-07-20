import type { AiInsight } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { AiBrainTenantScopeService } from "../services/ai-brain-tenant-scope.service";
import { MemoryEngineService } from "../services/memory-engine.service";
import { ReasoningEngineService } from "../services/reasoning-engine.service";

describe("ReasoningEngineService", () => {
  let service: ReasoningEngineService;
  let prisma: {
    order: { findMany: jest.Mock };
    inventoryItem: { findMany: jest.Mock };
    aiInsight: { create: jest.Mock };
  };
  let tenantScope: { resolveBranchIds: jest.Mock };
  let memory: { mostImportant: jest.Mock; record: jest.Mock };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      aiInsight: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "insight-1", ...data })),
      },
    };
    tenantScope = { resolveBranchIds: jest.fn().mockResolvedValue(["branch-1"]) };
    memory = { mostImportant: jest.fn().mockResolvedValue([]), record: jest.fn() };

    service = new ReasoningEngineService(
      prisma as unknown as PrismaService,
      tenantScope as unknown as AiBrainTenantScopeService,
      memory as unknown as MemoryEngineService,
    );
  });

  describe("sales", () => {
    it("reports no anomaly when revenue is stable week over week", async () => {
      prisma.order.findMany
        .mockResolvedValueOnce([{ total: 1000 }, { total: 1000 }]) // current
        .mockResolvedValueOnce([{ total: 1000 }, { total: 1000 }]); // previous

      const insight = await service.analyze("org-1", "sales", "branch-1");

      const content = prisma.aiInsight.create.mock.calls[0][0].data.content as {
        causes: string[];
        problem: string;
      };
      expect(content.causes).toEqual([]);
      expect(content.problem).toContain("No significant");
      expect(insight).toBeDefined();
      expect(memory.record).not.toHaveBeenCalled();
    });

    it("flags a revenue drop with a demand-side cause when order volume fell proportionally", async () => {
      prisma.order.findMany
        .mockResolvedValueOnce([{ total: 500 }]) // current: 500
        .mockResolvedValueOnce([{ total: 500 }, { total: 500 }]); // previous: 1000

      await service.analyze("org-1", "sales", "branch-1");

      const data = prisma.aiInsight.create.mock.calls[0][0].data;
      const content = data.content as { causes: string[]; confidence: number };
      expect(content.causes.length).toBeGreaterThan(0);
      expect(content.causes[0]).toMatch(/order volume/i);
      expect(data.confidence).toBeGreaterThanOrEqual(0.3);
      expect(memory.record).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ branchId: "branch-1", memoryType: "REASONING_SALES" }),
      );
    });

    it("scopes the query through the tenant-scope service, not a raw branchId", async () => {
      await service.analyze("org-1", "sales", "branch-1");

      expect(tenantScope.resolveBranchIds).toHaveBeenCalledWith("org-1", "branch-1");
      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.branchId).toEqual({ in: ["branch-1"] });
    });
  });

  describe("inventory", () => {
    it("identifies items at or below reorder threshold", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        { id: "i1", name: "Avocado", currentStock: 2, reorderThreshold: 5 },
        { id: "i2", name: "Milk", currentStock: 20, reorderThreshold: 5 },
      ]);

      const insight = await service.analyze("org-1", "inventory");

      const content = (insight as unknown as AiInsight & { content: { causes: string[] } }).content;
      expect(content.causes).toEqual(["Avocado is at 2 (reorder threshold 5)"]);
    });

    it("reports no risk when nothing is low", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        { id: "i1", name: "Milk", currentStock: 20, reorderThreshold: 5 },
      ]);

      const insight = await service.analyze("org-1", "inventory");
      const content = (insight as unknown as AiInsight & { content: { causes: string[] } }).content;
      expect(content.causes).toEqual([]);
    });
  });

  describe("customer", () => {
    it("flags a drop in distinct customers", async () => {
      prisma.order.findMany
        .mockResolvedValueOnce([{ userId: "u1" }]) // current: 1 distinct customer
        .mockResolvedValueOnce([{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }]); // previous: 3

      const insight = await service.analyze("org-1", "customer");
      const content = (insight as unknown as AiInsight & { content: { causes: string[] } }).content;
      expect(content.causes.some((c: string) => c.includes("customer count fell"))).toBe(true);
    });
  });

  describe("operational", () => {
    it("summarizes notable recent memories as causes", async () => {
      memory.mostImportant.mockResolvedValue([
        {
          id: "m1",
          memoryType: "SALES_DROP",
          importance: 0.8,
          createdAt: new Date("2026-07-01T00:00:00Z"),
        },
      ]);

      const insight = await service.analyze("org-1", "operational");
      const content = (insight as unknown as AiInsight & { content: { causes: string[] } }).content;
      expect(content.causes[0]).toContain("SALES_DROP");
    });

    it("reports nothing notable when no high-importance memories exist", async () => {
      memory.mostImportant.mockResolvedValue([{ id: "m1", memoryType: "NOTE", importance: 0.2 }]);

      const insight = await service.analyze("org-1", "operational");
      const content = (insight as unknown as AiInsight & { content: { causes: string[] } }).content;
      expect(content.causes).toEqual([]);
    });
  });

  describe("persistence", () => {
    it("persists the analysis as a REASONING AiInsight scoped to the organization", async () => {
      await service.analyze("org-1", "sales", "branch-1");

      const data = prisma.aiInsight.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe("org-1");
      expect(data.branchId).toBe("branch-1");
      expect(data.type).toBe("REASONING");
      expect(data.category).toBe("sales");
    });
  });
});
