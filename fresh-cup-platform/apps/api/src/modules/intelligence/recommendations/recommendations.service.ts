import { Injectable } from "@nestjs/common";
import { OrderStatus, type MenuItem } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { RecommendedItemDto } from "./dto/recommended-item.dto";

/** Same "counts as a real order" set used by AnalyticsService — cancelled/pending orders aren't behavioral signal. */
const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const MIN_CF_CANDIDATES = 3;

/**
 * All recommendation surfaces are computed on demand from Order/OrderItem —
 * no persisted "recommendation model" or offline training job, consistent
 * with AnalyticsService's on-demand-aggregate approach. Collaborative
 * filtering (user-based, via shared purchase history) is tried first for
 * personalized recommendations; a rule-based fallback (category affinity,
 * then trending) kicks in whenever there isn't enough co-purchase signal —
 * this is what makes the engine work for anonymous and first-time
 * customers, not just loyalty members with deep order history.
 */
@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: MenuItem, reason: string, score: number): RecommendedItemDto {
    return {
      menuItemId: item.id,
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      basePrice: item.basePrice,
      categoryId: item.categoryId,
      reason,
      score: Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000,
    };
  }

  private async coPurchasedMenuItemIds(
    anchorMenuItemIds: string[],
    excludeMenuItemIds: string[],
  ): Promise<Map<string, number>> {
    const anchorLines = await this.prisma.orderItem.findMany({
      where: { menuItemId: { in: anchorMenuItemIds }, order: { status: { in: COUNTED_STATUSES } } },
      select: { orderId: true },
    });
    const orderIds = Array.from(new Set(anchorLines.map((line) => line.orderId)));
    if (orderIds.length === 0) return new Map();

    const coLines = await this.prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, menuItemId: { notIn: excludeMenuItemIds } },
      select: { menuItemId: true },
    });

    const counts = new Map<string, number>();
    for (const line of coLines) {
      counts.set(line.menuItemId, (counts.get(line.menuItemId) ?? 0) + 1);
    }
    return counts;
  }

  /** "Frequently bought together" / "customers also ordered" for a single anchor product. */
  async frequentlyBoughtTogether(menuItemId: string, limit = 6): Promise<RecommendedItemDto[]> {
    const counts = await this.coPurchasedMenuItemIds([menuItemId], [menuItemId]);
    return this.rankAndHydrate(counts, "Frequently bought together", limit);
  }

  /** Cross-sell across an entire cart — co-occurrence anchored on every item currently in it. */
  async forCart(menuItemIds: string[], limit = 6): Promise<RecommendedItemDto[]> {
    if (menuItemIds.length === 0) return [];
    const counts = await this.coPurchasedMenuItemIds(menuItemIds, menuItemIds);
    return this.rankAndHydrate(counts, "Customers also ordered", limit);
  }

  /** Same category or overlapping tags — a content-based fallback that needs no order history at all. */
  async similarProducts(menuItemId: string, limit = 6): Promise<RecommendedItemDto[]> {
    const anchor = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!anchor) return [];

    const candidates = await this.prisma.menuItem.findMany({
      where: {
        id: { not: menuItemId },
        branchId: anchor.branchId,
        isAvailable: true,
        OR: [{ categoryId: anchor.categoryId }, { tags: { hasSome: anchor.tags } }],
      },
      take: 100,
    });

    const scored = candidates.map((item) => {
      const sharedTags = item.tags.filter((tag) => anchor.tags.includes(tag)).length;
      const categoryMatch = item.categoryId === anchor.categoryId ? 1 : 0;
      const score = categoryMatch * 0.6 + Math.min(1, sharedTags * 0.2);
      return { item, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item, score }) => this.toDto(item, "Similar to items you're viewing", score));
  }

  /** Recent sales velocity — the anonymous-customer and empty-cart default. */
  async trending(branchId?: string, limit = 8): Promise<RecommendedItemDto[]> {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const lines = await this.prisma.orderItem.findMany({
      where: {
        order: {
          ...(branchId ? { branchId } : {}),
          status: { in: COUNTED_STATUSES },
          placedAt: { gte: sevenDaysAgo },
        },
      },
      select: { menuItemId: true, quantity: true },
    });

    const quantityByItem = new Map<string, number>();
    for (const line of lines) {
      quantityByItem.set(
        line.menuItemId,
        (quantityByItem.get(line.menuItemId) ?? 0) + line.quantity,
      );
    }
    return this.rankAndHydrate(quantityByItem, "Trending this week", limit, branchId);
  }

  /** Items the catalog owner has flagged isSeasonal, filled out with featured items if there aren't enough. */
  async seasonal(branchId?: string, limit = 8): Promise<RecommendedItemDto[]> {
    const seasonalItems = await this.prisma.menuItem.findMany({
      where: { ...(branchId ? { branchId } : {}), isSeasonal: true, isAvailable: true },
      take: limit,
    });
    const result = seasonalItems.map((item) => this.toDto(item, "Seasonal pick", 0.8));
    if (result.length >= limit) return result;

    const featured = await this.prisma.menuItem.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        isFeatured: true,
        isAvailable: true,
        id: { notIn: seasonalItems.map((item) => item.id) },
      },
      take: limit - result.length,
    });
    return [...result, ...featured.map((item) => this.toDto(item, "Featured pick", 0.6))];
  }

  /** Upsell (pricier items in the same category) + cross-sell (frequently-bought-together from other categories). */
  async upsellCrossSell(menuItemId: string, limit = 6): Promise<RecommendedItemDto[]> {
    const anchor = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!anchor) return [];

    const upsellCandidates = await this.prisma.menuItem.findMany({
      where: {
        categoryId: anchor.categoryId,
        id: { not: menuItemId },
        isAvailable: true,
        basePrice: { gt: anchor.basePrice },
      },
      orderBy: { basePrice: "asc" },
      take: Math.ceil(limit / 2),
    });
    const upsell = upsellCandidates.map((item) => this.toDto(item, "Upgrade your order", 0.7));

    const crossSellCounts = await this.coPurchasedMenuItemIds(
      [menuItemId],
      [menuItemId, ...upsellCandidates.map((item) => item.id)],
    );
    const crossSell = await this.rankAndHydrate(
      crossSellCounts,
      "Goes well with this",
      limit - upsell.length,
    );

    return [...upsell, ...crossSell];
  }

  /**
   * Personalized picks: user-based collaborative filtering first (what did
   * customers who bought the same things also buy), falling back to
   * category-affinity when there isn't enough co-purchase signal, and to
   * plain trending for a brand-new customer with no order history at all.
   */
  async personalized(userId: string, branchId?: string, limit = 8): Promise<RecommendedItemDto[]> {
    const purchasedLines = await this.prisma.orderItem.findMany({
      where: { order: { userId, status: { in: COUNTED_STATUSES } } },
      select: { menuItemId: true, menuItem: { select: { categoryId: true } } },
    });
    const purchasedIds = Array.from(new Set(purchasedLines.map((line) => line.menuItemId)));

    if (purchasedIds.length === 0) {
      return this.trending(branchId, limit);
    }

    const collaborative = await this.collaborativeFilter(userId, purchasedIds, branchId, limit);
    if (collaborative.length >= MIN_CF_CANDIDATES) {
      return collaborative.slice(0, limit);
    }

    const categoryAffinity = await this.categoryAffinity(
      purchasedLines,
      purchasedIds,
      branchId,
      limit,
    );
    const merged = [...collaborative, ...categoryAffinity].slice(0, limit);
    if (merged.length > 0) return merged;

    return this.trending(branchId, limit);
  }

  private async collaborativeFilter(
    userId: string,
    purchasedIds: string[],
    branchId: string | undefined,
    limit: number,
  ): Promise<RecommendedItemDto[]> {
    const peerOrders = await this.prisma.orderItem.findMany({
      where: {
        menuItemId: { in: purchasedIds },
        order: { userId: { not: userId }, status: { in: COUNTED_STATUSES } },
      },
      select: { orderId: true },
      take: 500,
    });
    const peerOrderIds = Array.from(new Set(peerOrders.map((line) => line.orderId)));
    if (peerOrderIds.length === 0) return [];

    const peerLines = await this.prisma.orderItem.findMany({
      where: { orderId: { in: peerOrderIds }, menuItemId: { notIn: purchasedIds } },
      select: { menuItemId: true },
    });
    const counts = new Map<string, number>();
    for (const line of peerLines) {
      counts.set(line.menuItemId, (counts.get(line.menuItemId) ?? 0) + 1);
    }
    return this.rankAndHydrate(counts, "Customers like you also ordered", limit, branchId);
  }

  private async categoryAffinity(
    purchasedLines: { menuItemId: string; menuItem: { categoryId: string } }[],
    purchasedIds: string[],
    branchId: string | undefined,
    limit: number,
  ): Promise<RecommendedItemDto[]> {
    const categoryCounts = new Map<string, number>();
    for (const line of purchasedLines) {
      const categoryId = line.menuItem.categoryId;
      categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
    }
    const topCategoryIds = Array.from(categoryCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([categoryId]) => categoryId);
    if (topCategoryIds.length === 0) return [];

    const maxCount = Math.max(...categoryCounts.values());
    const candidates = await this.prisma.menuItem.findMany({
      where: {
        categoryId: { in: topCategoryIds },
        id: { notIn: purchasedIds },
        isAvailable: true,
        ...(branchId ? { branchId } : {}),
      },
      take: limit,
    });

    return candidates.map((item) =>
      this.toDto(
        item,
        "Because you like this category",
        (categoryCounts.get(item.categoryId) ?? 1) / maxCount,
      ),
    );
  }

  private async rankAndHydrate(
    counts: Map<string, number>,
    reason: string,
    limit: number,
    branchId?: string,
  ): Promise<RecommendedItemDto[]> {
    if (counts.size === 0) return [];
    const maxCount = Math.max(...counts.values());
    const topIds = Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([menuItemId]) => menuItemId);

    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: topIds }, isAvailable: true, ...(branchId ? { branchId } : {}) },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    return topIds
      .filter((id) => itemById.has(id))
      .map((id) => this.toDto(itemById.get(id)!, reason, (counts.get(id) ?? 0) / maxCount));
  }
}
