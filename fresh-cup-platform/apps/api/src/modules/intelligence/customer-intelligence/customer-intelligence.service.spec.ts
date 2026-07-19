import { UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import { CustomerIntelligenceService } from "./customer-intelligence.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };
const manager: RequestUser = { id: "mgr-1", role: UserRole.MANAGER, branchId: "branch-1" };

function order(overrides: Partial<Record<string, unknown>> = {}) {
  return { userId: "user-1", total: 10000, placedAt: new Date(), ...overrides };
}

describe("CustomerIntelligenceService", () => {
  let service: CustomerIntelligenceService;
  let prisma: {
    order: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    service = new CustomerIntelligenceService(prisma as unknown as PrismaService);
  });

  describe("segments", () => {
    it("scopes a manager's query to their own branch even if a different branchId is requested", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      await service.segments(manager, { branchId: "some-other-branch" });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ branchId: "branch-1" }) }),
      );
    });

    it("labels the highest-recency, highest-frequency, highest-spend customer a Champion", async () => {
      // A 10-customer population gives quintile scoring room to spread across
      // the full 1-5 range — a 2-customer population can never produce a
      // score of 5 for a middling percentile, which would make this
      // assertion about the *label* meaningless.
      const now = Date.now();
      const orders: ReturnType<typeof order>[] = [];
      // Champion: 8 recent, high-value orders.
      for (let i = 0; i < 8; i++) {
        orders.push(
          order({ userId: "champion", total: 50000, placedAt: new Date(now - i * 86400000) }),
        );
      }
      // Nine other customers with a single low-value order each, spread across
      // the last year, so champion's recency/frequency/monetary all land in
      // the top quintile.
      for (let i = 0; i < 9; i++) {
        orders.push(
          order({
            userId: `other-${i}`,
            total: 1000 + i * 500,
            placedAt: new Date(now - (30 + i * 40) * 86400000),
          }),
        );
      }
      prisma.order.findMany.mockResolvedValue(orders);
      prisma.user.findMany.mockResolvedValue([
        { id: "champion", fullName: "Champion Customer" },
        ...Array.from({ length: 9 }, (_, i) => ({ id: `other-${i}`, fullName: `Other ${i}` })),
      ]);

      const result = await service.segments(admin, {});

      const champion = result.find((c) => c.userId === "champion")!;
      const oldest = result.find((c) => c.userId === "other-8")!;
      expect(champion.segment).toBe("Champions");
      expect(champion.rfm.recency).toBe(5);
      expect(champion.rfm.frequency).toBe(5);
      expect(champion.rfm.monetary).toBe(5);
      expect(champion.churnRisk).toBeLessThan(oldest.churnRisk);
    });

    it("filters results down to only the requested segment", async () => {
      const now = Date.now();
      const orders: ReturnType<typeof order>[] = [];
      for (let i = 0; i < 8; i++) {
        orders.push(
          order({ userId: "champion", total: 50000, placedAt: new Date(now - i * 86400000) }),
        );
      }
      for (let i = 0; i < 9; i++) {
        orders.push(
          order({
            userId: `other-${i}`,
            total: 1000 + i * 500,
            placedAt: new Date(now - (30 + i * 40) * 86400000),
          }),
        );
      }
      prisma.order.findMany.mockResolvedValue(orders);
      prisma.user.findMany.mockResolvedValue([
        { id: "champion", fullName: "Champion Customer" },
        ...Array.from({ length: 9 }, (_, i) => ({ id: `other-${i}`, fullName: `Other ${i}` })),
      ]);

      const unfiltered = await service.segments(admin, {});
      const championSegment = unfiltered.find((c) => c.userId === "champion")!.segment;

      const filtered = await service.segments(admin, { segment: championSegment });

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((c) => c.segment === championSegment)).toBe(true);
      expect(filtered.some((c) => c.userId === "champion")).toBe(true);
    });
  });

  describe("segmentSummary", () => {
    it("aggregates customer counts and spend per segment", async () => {
      const now = Date.now();
      prisma.order.findMany.mockResolvedValue([
        order({ userId: "a", total: 10000, placedAt: new Date(now) }),
        order({ userId: "b", total: 20000, placedAt: new Date(now) }),
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: "a", fullName: "A" },
        { id: "b", fullName: "B" },
      ]);

      const result = await service.segmentSummary(admin, undefined);

      const totalCustomers = result.reduce((sum, s) => sum + s.customerCount, 0);
      const totalSpend = result.reduce((sum, s) => sum + s.totalSpend, 0);
      expect(totalCustomers).toBe(2);
      expect(totalSpend).toBe(30000);
    });
  });
});
