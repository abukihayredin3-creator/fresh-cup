import { ForbiddenException, Injectable } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { EnterpriseDateRangeDto } from "./dto/date-range.dto";

/** Orders past the payment gate — same convention as modules/analytics's AnalyticsService. */
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

export interface BranchIdentity {
  id: string;
  name: string;
}

export interface BranchRevenueMetric extends BranchIdentity {
  revenueMinor: number;
  orderCount: number;
  averageOrderValueMinor: number;
}

export interface RollupResult {
  branchCount: number;
  totalRevenueMinor: number;
  totalOrders: number;
  averageOrderValueMinor: number;
  byBranch: BranchRevenueMetric[];
}

export interface RegionRollup extends RollupResult {
  regionId: string | null;
  regionName: string;
}

/**
 * Corporate/franchise/cross-region analytics — rolls up existing Order
 * data across a SET of branches under a tenant. This is a genuinely new
 * capability (Phase 5/6's AnalyticsService and ExecutiveService are
 * actor-branch-scoped, single-branch or actor's-permitted-branches at
 * most; nothing before Phase 8 aggregates across an entire organization,
 * franchise, or region). Uses the same PAID_STATUSES "counts as revenue"
 * convention as modules/analytics/analytics.service.ts.
 */
@Injectable()
export class EnterpriseAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveWindow(dateRange: EnterpriseDateRangeDto): { from: Date; to: Date } {
    const to = dateRange.to ? new Date(dateRange.to) : new Date();
    const from = dateRange.from
      ? new Date(dateRange.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  private async orgBranches(organizationId: string): Promise<BranchIdentity[]> {
    return this.prisma.branch.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  private async rollup(branches: BranchIdentity[], from: Date, to: Date): Promise<RollupResult> {
    if (branches.length === 0) {
      return {
        branchCount: 0,
        totalRevenueMinor: 0,
        totalOrders: 0,
        averageOrderValueMinor: 0,
        byBranch: [],
      };
    }
    const branchIds = branches.map((b) => b.id);
    const grouped = await this.prisma.order.groupBy({
      by: ["branchId"],
      where: {
        branchId: { in: branchIds },
        status: { in: PAID_STATUSES },
        placedAt: { gte: from, lte: to },
      },
      _sum: { total: true },
      _count: { _all: true },
    });
    const byBranchId = new Map(grouped.map((row) => [row.branchId, row]));

    const byBranch: BranchRevenueMetric[] = branches.map((branch) => {
      const row = byBranchId.get(branch.id);
      const revenueMinor = row?._sum.total ?? 0;
      const orderCount = row?._count._all ?? 0;
      return {
        ...branch,
        revenueMinor,
        orderCount,
        averageOrderValueMinor: orderCount > 0 ? Math.round(revenueMinor / orderCount) : 0,
      };
    });

    const totalRevenueMinor = byBranch.reduce((sum, b) => sum + b.revenueMinor, 0);
    const totalOrders = byBranch.reduce((sum, b) => sum + b.orderCount, 0);
    return {
      branchCount: branches.length,
      totalRevenueMinor,
      totalOrders,
      averageOrderValueMinor: totalOrders > 0 ? Math.round(totalRevenueMinor / totalOrders) : 0,
      byBranch,
    };
  }

  async corporateDashboard(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    const { from, to } = this.resolveWindow(dateRange);
    const branches = await this.orgBranches(organizationId);
    return this.rollup(branches, from, to);
  }

  async franchiseAnalytics(
    organizationId: string,
    franchiseId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    const franchise = await this.prisma.franchise.findUnique({ where: { id: franchiseId } });
    if (!franchise || franchise.organizationId !== organizationId) {
      throw new ForbiddenException("That franchise does not belong to your organization");
    }
    const { from, to } = this.resolveWindow(dateRange);
    const branches = await this.prisma.branch.findMany({
      where: { franchiseId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return this.rollup(branches, from, to);
  }

  async regionAnalytics(
    organizationId: string,
    regionId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    const region = await this.prisma.region.findUnique({ where: { id: regionId } });
    if (!region || region.organizationId !== organizationId) {
      throw new ForbiddenException("That region does not belong to your organization");
    }
    const { from, to } = this.resolveWindow(dateRange);
    const branches = await this.prisma.branch.findMany({
      where: { regionId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return this.rollup(branches, from, to);
  }

  async branchGroupAnalytics(
    organizationId: string,
    branchGroupId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    const group = await this.prisma.branchGroup.findUnique({ where: { id: branchGroupId } });
    if (!group || group.organizationId !== organizationId) {
      throw new ForbiddenException("That branch group does not belong to your organization");
    }
    const { from, to } = this.resolveWindow(dateRange);
    const memberships = await this.prisma.branchGroupMembership.findMany({
      where: { branchGroupId },
      select: { branchId: true },
    });
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: memberships.map((m) => m.branchId) } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return this.rollup(branches, from, to);
  }

  /** One rollup per region, plus an "Unassigned" bucket for branches with no region. */
  async crossRegionAnalytics(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<RegionRollup[]> {
    const { from, to } = this.resolveWindow(dateRange);
    const [regions, branches] = await Promise.all([
      this.prisma.region.findMany({ where: { organizationId } }),
      this.prisma.branch.findMany({
        where: { organizationId },
        select: { id: true, name: true, regionId: true },
      }),
    ]);

    const results: RegionRollup[] = [];
    for (const region of regions) {
      const regionBranches = branches.filter((b) => b.regionId === region.id);
      const rollup = await this.rollup(regionBranches, from, to);
      results.push({ regionId: region.id, regionName: region.name, ...rollup });
    }

    const unassigned = branches.filter((b) => b.regionId === null);
    if (unassigned.length > 0) {
      const rollup = await this.rollup(unassigned, from, to);
      results.push({ regionId: null, regionName: "Unassigned", ...rollup });
    }

    return results;
  }

  async listOrgBranches(organizationId: string): Promise<BranchIdentity[]> {
    return this.orgBranches(organizationId);
  }
}
