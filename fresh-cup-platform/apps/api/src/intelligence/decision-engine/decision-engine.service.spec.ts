import { ApprovalActionType } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import type { ExecutiveService } from "../../modules/intelligence/executive/executive.service";
import type { ApprovalService } from "../approvals/approval.service";
import { DecisionEngineService } from "./decision-engine.service";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };

function overview(totalRevenue: number, ordersPlaced: number, trendValues: number[]) {
  return {
    totalRevenue,
    revenueTrend: trendValues.map((revenue, i) => ({
      date: `2026-07-${10 + i}`,
      revenue,
      estimatedProfit: 0,
    })),
    conversionMetrics: { cartsCreated: 0, ordersPlaced, conversionRate: 0 },
  } as never;
}

describe("DecisionEngineService", () => {
  function makeService() {
    const prisma = {
      coupon: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as jest.Mocked<PrismaService>;
    const executiveService = {
      overview: jest.fn(),
    } as unknown as jest.Mocked<ExecutiveService>;
    const approvals = {
      request: jest
        .fn()
        .mockImplementation(({ actionType }) => Promise.resolve({ id: `req-${actionType}` })),
    } as unknown as jest.Mocked<ApprovalService>;
    const service = new DecisionEngineService(prisma, executiveService, approvals);
    return { service, prisma, executiveService, approvals };
  }

  it("returns null when previous week had no revenue", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview
      .mockResolvedValueOnce(overview(100000, 20, [10000, 10000]))
      .mockResolvedValueOnce(overview(0, 0, []));

    const report = await service.detectSalesDrop(ACTOR);
    expect(report).toBeNull();
  });

  it("returns null when revenue did not drop enough", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview
      .mockResolvedValueOnce(overview(95000, 20, [13000, 14000]))
      .mockResolvedValueOnce(overview(100000, 20, [14000, 14000]));

    const report = await service.detectSalesDrop(ACTOR);
    expect(report).toBeNull();
  });

  it("detects a significant drop and attributes it to a declining trend", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview
      .mockResolvedValueOnce(overview(70000, 18, [20000, 15000, 10000, 5000]))
      .mockResolvedValueOnce(overview(100000, 20, [14000, 14000, 14000, 14000]));

    const report = await service.detectSalesDrop(ACTOR);

    expect(report).not.toBeNull();
    expect(report!.changePercent).toBeCloseTo(-30, 0);
    expect(report!.reasons.some((r) => r.factor === "Declining revenue trend")).toBe(true);
    expect(report!.recommendations).toHaveLength(3);
    expect(report!.totalExpectedImpactEtb).toBeGreaterThan(0);
  });

  it("adds a low-foot-traffic reason when order count also dropped", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview
      .mockResolvedValueOnce(overview(70000, 10, [14000, 14000]))
      .mockResolvedValueOnce(overview(100000, 20, [14000, 14000]));

    const report = await service.detectSalesDrop(ACTOR);
    expect(report!.reasons.some((r) => r.factor === "Low foot traffic")).toBe(true);
  });

  it("adds an expired-campaign reason when coupons recently expired", async () => {
    const { service, executiveService, prisma } = makeService();
    (prisma.coupon.count as jest.Mock).mockResolvedValue(2);
    executiveService.overview
      .mockResolvedValueOnce(overview(70000, 20, [14000, 14000]))
      .mockResolvedValueOnce(overview(100000, 20, [14000, 14000]));

    const report = await service.detectSalesDrop(ACTOR);
    expect(report!.reasons.some((r) => r.factor === "Expired campaign/coupon")).toBe(true);
  });

  it("falls back to an Undetermined reason when no signal explains the drop", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview
      .mockResolvedValueOnce(overview(70000, 20, [14000, 14000]))
      .mockResolvedValueOnce(overview(100000, 20, [14000, 14000]));

    const report = await service.detectSalesDrop(ACTOR);
    expect(report!.reasons).toEqual([expect.objectContaining({ factor: "Undetermined" })]);
  });

  it("draftApprovals=true writes DISCOUNT and MARKETING_CAMPAIGN drafts to the approval layer", async () => {
    const { service, executiveService, approvals } = makeService();
    executiveService.overview
      .mockResolvedValueOnce(overview(70000, 20, [14000, 14000]))
      .mockResolvedValueOnce(overview(100000, 20, [14000, 14000]));

    const report = await service.detectSalesDrop(ACTOR, "b1", true);

    expect(approvals.request).toHaveBeenCalledTimes(2);
    const discountRec = report!.recommendations.find(
      (r) => r.approvalActionType === ApprovalActionType.DISCOUNT,
    );
    const otherRec = report!.recommendations.find(
      (r) => r.approvalActionType === ApprovalActionType.OTHER,
    );
    expect(discountRec!.approvalRequestId).toBe(`req-${ApprovalActionType.DISCOUNT}`);
    expect(otherRec!.approvalRequestId).toBeUndefined();
  });
});
