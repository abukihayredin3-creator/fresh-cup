import { Injectable } from "@nestjs/common";
import { OrderStatus, UserRole } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { ClusterAssignment, CustomerVector } from "./clustering-strategy.interface";
import { KMeansClusteringStrategy } from "./kmeans-clustering.strategy";
import { RuleBasedClusteringStrategy } from "./rule-based-clustering.strategy";

const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ClusteringStrategyName = "rule-based" | "kmeans";

@Injectable()
export class CustomerSegmentationService {
  private readonly strategies: Record<
    ClusteringStrategyName,
    RuleBasedClusteringStrategy | KMeansClusteringStrategy
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleBased: RuleBasedClusteringStrategy,
    private readonly kmeans: KMeansClusteringStrategy,
  ) {
    this.strategies = { "rule-based": this.ruleBased, kmeans: this.kmeans };
  }

  private resolveBranchScope(actor: RequestUser, branchId?: string): string | undefined {
    if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      return actor.branchId ?? "__no_branch__";
    }
    return branchId;
  }

  private async customerVectors(branchId?: string): Promise<CustomerVector[]> {
    const orders = await this.prisma.order.findMany({
      where: { ...(branchId ? { branchId } : {}), status: { in: COUNTED_STATUSES } },
      select: { userId: true, total: true, placedAt: true, user: { select: { fullName: true } } },
    });

    const byUser = new Map<
      string,
      { fullName: string; ordersCount: number; totalSpend: number; lastOrderAt: Date }
    >();
    for (const order of orders) {
      const bucket = byUser.get(order.userId) ?? {
        fullName: order.user.fullName,
        ordersCount: 0,
        totalSpend: 0,
        lastOrderAt: order.placedAt,
      };
      bucket.ordersCount += 1;
      bucket.totalSpend += order.total;
      if (order.placedAt > bucket.lastOrderAt) bucket.lastOrderAt = order.placedAt;
      byUser.set(order.userId, bucket);
    }

    const now = Date.now();
    return Array.from(byUser.entries()).map(([userId, bucket]) => ({
      userId,
      fullName: bucket.fullName,
      recencyDays: Math.max(0, (now - bucket.lastOrderAt.getTime()) / MS_PER_DAY),
      ordersCount: bucket.ordersCount,
      totalSpendEtb: bucket.totalSpend / 100,
    }));
  }

  async segment(
    actor: RequestUser,
    branchId?: string,
    strategy: ClusteringStrategyName = "rule-based",
  ): Promise<ClusterAssignment[]> {
    const scopedBranchId = this.resolveBranchScope(actor, branchId);
    const vectors = await this.customerVectors(scopedBranchId);
    return this.strategies[strategy].cluster(vectors);
  }

  async summary(
    actor: RequestUser,
    branchId?: string,
    strategy: ClusteringStrategyName = "rule-based",
  ): Promise<{ segment: string; customerCount: number }[]> {
    const assignments = await this.segment(actor, branchId, strategy);
    const counts = new Map<string, number>();
    for (const a of assignments) {
      counts.set(a.segment, (counts.get(a.segment) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([segment, customerCount]) => ({
      segment,
      customerCount,
    }));
  }
}
