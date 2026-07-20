import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { EnterpriseAnalyticsService } from "./enterprise-analytics.service";

describe("EnterpriseAnalyticsService", () => {
  function makeService(
    overrides: {
      branches?: unknown[];
      grouped?: unknown[];
      franchise?: unknown;
      region?: unknown;
      branchGroup?: unknown;
      memberships?: unknown[];
    } = {},
  ) {
    const prisma = {
      branch: {
        findMany: jest.fn().mockResolvedValue(overrides.branches ?? []),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue(overrides.grouped ?? []),
      },
      franchise: { findUnique: jest.fn().mockResolvedValue(overrides.franchise ?? null) },
      region: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(overrides.region ?? null),
      },
      branchGroup: { findUnique: jest.fn().mockResolvedValue(overrides.branchGroup ?? null) },
      branchGroupMembership: { findMany: jest.fn().mockResolvedValue(overrides.memberships ?? []) },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new EnterpriseAnalyticsService(prisma), prisma };
  }

  it("rolls up corporate revenue across all org branches, defaulting missing branches to zero", async () => {
    const { service } = makeService({
      branches: [
        { id: "b1", name: "Branch 1" },
        { id: "b2", name: "Branch 2" },
      ],
      grouped: [{ branchId: "b1", _sum: { total: 10000 }, _count: { _all: 4 } }],
    });
    const result = await service.corporateDashboard("org-1", {});
    expect(result.branchCount).toBe(2);
    expect(result.totalRevenueMinor).toBe(10000);
    expect(result.totalOrders).toBe(4);
    expect(result.byBranch).toEqual([
      {
        id: "b1",
        name: "Branch 1",
        revenueMinor: 10000,
        orderCount: 4,
        averageOrderValueMinor: 2500,
      },
      { id: "b2", name: "Branch 2", revenueMinor: 0, orderCount: 0, averageOrderValueMinor: 0 },
    ]);
  });

  it("returns an empty rollup for an organization with no branches", async () => {
    const { service } = makeService({ branches: [] });
    const result = await service.corporateDashboard("org-1", {});
    expect(result).toEqual({
      branchCount: 0,
      totalRevenueMinor: 0,
      totalOrders: 0,
      averageOrderValueMinor: 0,
      byBranch: [],
    });
  });

  it("throws ForbiddenException for a franchise outside the organization", async () => {
    const { service } = makeService({ franchise: { id: "f1", organizationId: "org-2" } });
    await expect(service.franchiseAnalytics("org-1", "f1", {})).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException for a region outside the organization", async () => {
    const { service } = makeService({ region: { id: "r1", organizationId: "org-2" } });
    await expect(service.regionAnalytics("org-1", "r1", {})).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException for a branch group outside the organization", async () => {
    const { service } = makeService({ branchGroup: { id: "g1", organizationId: "org-2" } });
    await expect(service.branchGroupAnalytics("org-1", "g1", {})).rejects.toThrow(
      ForbiddenException,
    );
  });
});
