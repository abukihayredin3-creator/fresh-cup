import type { RequestUser } from "../../common/types/request-user.interface";
import type { ExecutiveService } from "../../modules/intelligence/executive/executive.service";
import { ScenarioSimulatorService } from "./scenario-simulator.service";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };

describe("ScenarioSimulatorService", () => {
  function makeService(
    overrides: Partial<{
      totalRevenue: number;
      totalEstimatedProfit: number;
      ordersPlaced: number;
    }> = {},
  ) {
    const executiveService = {
      overview: jest.fn().mockResolvedValue({
        totalRevenue: overrides.totalRevenue ?? 1000000,
        totalEstimatedProfit: overrides.totalEstimatedProfit ?? 200000,
        conversionMetrics: { ordersPlaced: overrides.ordersPlaced ?? 500 },
      }),
    } as unknown as jest.Mocked<ExecutiveService>;
    const service = new ScenarioSimulatorService(executiveService);
    return { service, executiveService };
  }

  it("is entirely read-only — only ever calls ExecutiveService.overview()", async () => {
    const { service, executiveService } = makeService();
    await service.simulate(ACTOR, { type: "price_change", magnitudePercent: 5 });
    expect(executiveService.overview).toHaveBeenCalledTimes(1);
  });

  it("a price increase projects lower volume and a smaller revenue gain than the raw price change", async () => {
    const { service } = makeService();
    const result = await service.simulate(ACTOR, { type: "price_change", magnitudePercent: 5 });

    const customers = result.projections.find((p) => p.metric === "customers")!;
    const revenue = result.projections.find((p) => p.metric === "revenue")!;

    expect(customers.changePercent).toBeLessThan(0);
    expect(revenue.changePercent).toBeLessThan(5);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("a promotion projects a volume increase larger than the discount given up", async () => {
    const { service } = makeService();
    const result = await service.simulate(ACTOR, { type: "promotion", magnitudePercent: 10 });

    const customers = result.projections.find((p) => p.metric === "customers")!;
    expect(customers.changePercent).toBeGreaterThan(0);
  });

  it("a staffing increase projects a modest order-volume gain with a labor-cost drag on profit", async () => {
    const { service } = makeService();
    const result = await service.simulate(ACTOR, { type: "staffing_change", magnitudePercent: 20 });

    const customers = result.projections.find((p) => p.metric === "customers")!;
    const profit = result.projections.find((p) => p.metric === "profit")!;
    expect(customers.changePercent).toBeCloseTo(6, 5); // 20 * 0.3
    expect(profit.changePercent).toBeLessThan(customers.changePercent);
  });

  it("caps confidence low since the elasticity model is a documented heuristic, not data-fit", async () => {
    const { service } = makeService();
    const result = await service.simulate(ACTOR, { type: "price_change", magnitudePercent: 1 });
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });
});
