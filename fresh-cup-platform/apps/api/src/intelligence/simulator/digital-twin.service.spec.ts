import type { RequestUser } from "../../common/types/request-user.interface";
import type { ScenarioSimulatorService } from "./scenario-simulator.service";
import { DigitalTwinService } from "./digital-twin.service";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };

describe("DigitalTwinService", () => {
  function makeService() {
    const simulator = {
      simulate: jest.fn().mockResolvedValue({
        scenario: { type: "price_change", magnitudePercent: 5 },
        assumptions: [],
        projections: [
          { metric: "revenue", baseline: 300000, projected: 315000, changePercent: 5 },
          { metric: "customers", baseline: 900, projected: 850, changePercent: -5.56 },
          { metric: "profit", baseline: 60000, projected: 63000, changePercent: 5 },
          { metric: "inventoryDemand", baseline: 900, projected: 850, changePercent: -5.56 },
        ],
        confidence: 0.35,
        generatedAt: new Date().toISOString(),
      }),
    } as unknown as jest.Mocked<ScenarioSimulatorService>;
    const service = new DigitalTwinService(simulator);
    return { service, simulator };
  }

  it("never calls anything except the read-only scenario simulator", async () => {
    const { service, simulator } = makeService();
    await service.run(ACTOR, { type: "price_change", magnitudePercent: 5 });
    expect(simulator.simulate).toHaveBeenCalledTimes(1);
  });

  it("ramps the effect in over rampDays, reaching full strength by then", async () => {
    const { service } = makeService();
    const result = await service.run(ACTOR, { type: "price_change", magnitudePercent: 5 }, 10, 5);

    expect(result.timeline).toHaveLength(10);
    // Day 1 should be a small fraction of the day-30 baseline revenue swing.
    expect(result.timeline[0]!.revenueEtb).toBeLessThan(result.timeline[4]!.revenueEtb);
    // From day 5 (rampDays) onward, the daily change should plateau.
    expect(result.timeline[4]!.revenueEtb).toBe(result.timeline[9]!.revenueEtb);
  });

  it("includes the underlying scenario result as finalState", async () => {
    const { service } = makeService();
    const result = await service.run(ACTOR, { type: "promotion", magnitudePercent: 10 });
    expect(result.finalState.confidence).toBe(0.35);
    expect(result.scenario.type).toBe("promotion");
  });
});
