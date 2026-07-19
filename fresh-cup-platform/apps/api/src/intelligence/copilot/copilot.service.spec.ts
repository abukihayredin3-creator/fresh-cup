import type { RequestUser } from "../../common/types/request-user.interface";
import type { CoordinatorAgentService } from "../agents/coordinator-agent.service";
import type { DecisionEngineService } from "../decision-engine/decision-engine.service";
import type { ForecastingFacadeService } from "../forecasting/forecasting-facade.service";
import type { ExplanationService } from "../services/explanation.service";
import { CopilotService } from "./copilot.service";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };

describe("CopilotService", () => {
  function makeService() {
    const coordinator = {
      ask: jest.fn().mockResolvedValue({
        question: "How was this week?",
        routedAgents: ["executive"],
        answers: [
          {
            agentKey: "executive",
            agentName: "Executive Agent",
            domain: "executive",
            summary: "s",
            confidence: 0.8,
            insights: [
              { title: "A", explanation: "explain A", confidence: 0.9, data: {} },
              { title: "B", explanation: "explain B", confidence: 0.3, data: {} },
            ],
          },
        ],
        synthesis: "1. [Executive Agent] s",
        confidence: 0.8,
      }),
    } as unknown as jest.Mocked<CoordinatorAgentService>;

    const decisionEngine = {
      detectSalesDrop: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<DecisionEngineService>;

    const forecasting = {
      revenue: jest.fn().mockResolvedValue({
        modelKey: "sales-revenue",
        modelVersion: 1,
        prediction: 50000,
        confidence: 0.7,
        topReasons: ["trend"],
        contributingFactors: [],
        suggestedAction: "plan staffing",
      }),
    } as unknown as jest.Mocked<ForecastingFacadeService>;

    const explanation = {
      explain: jest.fn().mockResolvedValue("Revenue is steady this week."),
    } as unknown as jest.Mocked<ExplanationService>;

    const service = new CopilotService(coordinator, decisionEngine, forecasting, explanation);
    return { service, coordinator, decisionEngine, forecasting, explanation };
  }

  it("runs all 5 reasoning steps in order", async () => {
    const { service } = makeService();
    const response = await service.ask(ACTOR, "How was this week?", "b1");

    expect(response.steps.map((s) => s.step)).toEqual([
      "collect",
      "analyze_compare",
      "forecast",
      "explain",
      "recommend",
    ]);
  });

  it("falls back to the lowest-confidence insights as recommendations when no decision report exists", async () => {
    const { service } = makeService();
    const response = await service.ask(ACTOR, "How was this week?");

    expect(response.decisionReport).toBeNull();
    expect(response.recommendations).toHaveLength(2);
    expect(response.recommendations[0]!.action).toContain("explain B");
  });

  it("uses the decision engine's recommendations when a drop was detected", async () => {
    const { service, decisionEngine } = makeService();
    (decisionEngine.detectSalesDrop as jest.Mock).mockResolvedValue({
      issue: "Sales decline detected",
      metric: "weekly revenue",
      changePercent: -20,
      currentValueEtb: 80000,
      previousValueEtb: 100000,
      reasons: [{ factor: "x", evidence: "y", confidence: 0.5 }],
      recommendations: [
        {
          action: "Launch a coupon",
          expectedImpactEtb: 5000,
          confidence: 0.5,
          requiresApproval: true,
        },
      ],
      totalExpectedImpactEtb: 5000,
      generatedAt: new Date().toISOString(),
    });

    const response = await service.ask(ACTOR, "why did sales drop?");
    expect(response.recommendations).toEqual([
      { action: "Launch a coupon", expectedImpactEtb: 5000, confidence: 0.5 },
    ]);
  });

  it("includes the forecast and explanation in the response", async () => {
    const { service } = makeService();
    const response = await service.ask(ACTOR, "forecast please");
    expect(response.forecast?.prediction).toBe(50000);
    expect(response.explanation).toBe("Revenue is steady this week.");
  });

  it("calls onStep once per finished step, in order, before the final response resolves", async () => {
    const { service } = makeService();
    const seen: string[] = [];

    const response = await service.ask(ACTOR, "How was this week?", "b1", (step) => {
      seen.push(step.step);
    });

    expect(seen).toEqual(response.steps.map((s) => s.step));
    expect(seen).toEqual(["collect", "analyze_compare", "forecast", "explain", "recommend"]);
  });
});
