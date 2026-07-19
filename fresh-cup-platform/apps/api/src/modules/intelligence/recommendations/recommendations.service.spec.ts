import type { PrismaService } from "../../../database/prisma.service";
import { RecommendationsService } from "./recommendations.service";

function menuItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    branchId: "branch-1",
    categoryId: "cat-1",
    nameEn: "Green Energy",
    nameAm: null,
    basePrice: 15000,
    tags: [] as string[],
    isAvailable: true,
    isSeasonal: false,
    isFeatured: false,
    ...overrides,
  };
}

describe("RecommendationsService", () => {
  let service: RecommendationsService;
  let prisma: {
    orderItem: { findMany: jest.Mock };
    menuItem: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      orderItem: { findMany: jest.fn() },
      menuItem: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new RecommendationsService(prisma as unknown as PrismaService);
  });

  describe("frequentlyBoughtTogether", () => {
    it("ranks co-purchased items by frequency, excluding the anchor item", async () => {
      // Anchor item's orders
      prisma.orderItem.findMany.mockResolvedValueOnce([
        { orderId: "o1" },
        { orderId: "o2" },
        { orderId: "o3" },
      ]);
      // Co-purchased lines across those orders
      prisma.orderItem.findMany.mockResolvedValueOnce([
        { menuItemId: "item-2" },
        { menuItemId: "item-2" },
        { menuItemId: "item-3" },
      ]);
      prisma.menuItem.findMany.mockResolvedValueOnce([
        menuItem({ id: "item-2", nameEn: "Berry Boost" }),
        menuItem({ id: "item-3", nameEn: "Mango Sunrise" }),
      ]);

      const result = await service.frequentlyBoughtTogether("item-1", 6);

      expect(result).toHaveLength(2);
      expect(result[0]!.menuItemId).toBe("item-2"); // higher co-occurrence count
      expect(result[0]!.score).toBe(1);
      expect(result[1]!.score).toBeLessThan(1);
      expect(result.every((r) => r.reason === "Frequently bought together")).toBe(true);
    });

    it("returns an empty list when the anchor item has never been ordered", async () => {
      prisma.orderItem.findMany.mockResolvedValueOnce([]);

      const result = await service.frequentlyBoughtTogether("item-1", 6);

      expect(result).toEqual([]);
      expect(prisma.menuItem.findMany).not.toHaveBeenCalled();
    });
  });

  describe("similarProducts", () => {
    it("scores same-category items higher than tag-only matches", async () => {
      prisma.menuItem.findUnique.mockResolvedValue(
        menuItem({ id: "item-1", categoryId: "cat-1", tags: ["vegan", "cold"] }),
      );
      prisma.menuItem.findMany.mockResolvedValue([
        menuItem({ id: "item-2", categoryId: "cat-1", tags: [] }),
        menuItem({ id: "item-3", categoryId: "cat-2", tags: ["vegan"] }),
      ]);

      const result = await service.similarProducts("item-1", 6);

      expect(result[0]!.menuItemId).toBe("item-2");
      expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
    });

    it("returns an empty list for an unknown menu item", async () => {
      prisma.menuItem.findUnique.mockResolvedValue(null);

      const result = await service.similarProducts("missing-item", 6);

      expect(result).toEqual([]);
    });
  });

  describe("trending", () => {
    it("ranks items by trailing 7-day quantity sold", async () => {
      prisma.orderItem.findMany.mockResolvedValueOnce([
        { menuItemId: "item-1", quantity: 5 },
        { menuItemId: "item-1", quantity: 3 },
        { menuItemId: "item-2", quantity: 2 },
      ]);
      prisma.menuItem.findMany.mockResolvedValueOnce([
        menuItem({ id: "item-1", nameEn: "Green Energy" }),
        menuItem({ id: "item-2", nameEn: "Berry Boost" }),
      ]);

      const result = await service.trending(undefined, 8);

      expect(result[0]!.menuItemId).toBe("item-1");
      expect(result[0]!.score).toBe(1);
      expect(result[0]!.reason).toBe("Trending this week");
    });
  });

  describe("seasonal", () => {
    it("falls back to featured items when there aren't enough seasonal ones", async () => {
      prisma.menuItem.findMany
        .mockResolvedValueOnce([menuItem({ id: "item-1", isSeasonal: true })])
        .mockResolvedValueOnce([menuItem({ id: "item-2", isFeatured: true })]);

      const result = await service.seasonal(undefined, 2);

      expect(result.map((r) => r.menuItemId)).toEqual(["item-1", "item-2"]);
      expect(result[0]!.reason).toBe("Seasonal pick");
      expect(result[1]!.reason).toBe("Featured pick");
    });
  });

  describe("personalized", () => {
    it("falls back to trending for a customer with no order history", async () => {
      prisma.orderItem.findMany.mockResolvedValueOnce([]); // purchasedLines
      prisma.orderItem.findMany.mockResolvedValueOnce([]); // trending() query
      prisma.menuItem.findMany.mockResolvedValueOnce([]);

      const result = await service.personalized("user-1", undefined, 8);

      expect(result).toEqual([]);
      // Only the purchase-history lookup and the trending() fallback query ran —
      // no collaborative-filtering or category-affinity queries were reached.
      expect(prisma.orderItem.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
