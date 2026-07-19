import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ScenarioSimulatorService } from "./scenario-simulator.service";
import type { ScenarioInput, ScenarioResult } from "./scenario-simulator.types";

export interface DigitalTwinDay {
  day: number;
  revenueEtb: number;
  customers: number;
  profitEtb: number;
}

export interface DigitalTwinResult {
  scenario: ScenarioInput;
  finalState: ScenarioResult;
  timeline: DigitalTwinDay[];
}

const DEFAULT_HORIZON_DAYS = 14;
const DEFAULT_RAMP_DAYS = 5;

/**
 * Digital Twin — "run a simulation without touching production" (Phase 11
 * Part 3). This is deliberately NOT a separate simulated database: it's a
 * strictly read-only orchestration over `ScenarioSimulatorService` (which
 * itself only calls `ExecutiveService.overview()`, never a write method),
 * projected across a horizon with a linear ramp — day 1 feels a fraction
 * of the scenario's effect, day `rampDays` feels the full effect. No
 * `PrismaService` write call exists anywhere in this file or in
 * `ScenarioSimulatorService`; "without touching production" is enforced
 * by what this code simply never imports, not by a runtime guard.
 */
@Injectable()
export class DigitalTwinService {
  constructor(private readonly simulator: ScenarioSimulatorService) {}

  async run(
    actor: RequestUser,
    input: ScenarioInput,
    horizonDays = DEFAULT_HORIZON_DAYS,
    rampDays = DEFAULT_RAMP_DAYS,
  ): Promise<DigitalTwinResult> {
    const finalState = await this.simulator.simulate(actor, input);
    const revenue = finalState.projections.find((p) => p.metric === "revenue")!;
    const customers = finalState.projections.find((p) => p.metric === "customers")!;
    const profit = finalState.projections.find((p) => p.metric === "profit")!;

    const dailyBaselineRevenue = revenue.baseline / 30;
    const dailyBaselineCustomers = customers.baseline / 30;
    const dailyBaselineProfit = profit.baseline / 30;

    const timeline: DigitalTwinDay[] = Array.from({ length: horizonDays }, (_, i) => {
      const day = i + 1;
      const rampFraction = Math.min(day / rampDays, 1);
      return {
        day,
        revenueEtb: Math.round(
          dailyBaselineRevenue * (1 + (revenue.changePercent / 100) * rampFraction),
        ),
        customers: Math.round(
          dailyBaselineCustomers * (1 + (customers.changePercent / 100) * rampFraction),
        ),
        profitEtb: Math.round(
          dailyBaselineProfit * (1 + (profit.changePercent / 100) * rampFraction),
        ),
      };
    });

    return { scenario: input, finalState, timeline };
  }
}
