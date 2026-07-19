import type { RequestUser } from "../../common/types/request-user.interface";
import type { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";
import { FinanceAgent } from "./finance.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("FinanceAgent", () => {
  it("combines revenue explanation and growth-opportunity insights", async () => {
    const executiveAi = {
      revenueExplanation: jest.fn().mockResolvedValue(insight(0.75)),
      growthOpportunities: jest.fn().mockResolvedValue([insight(0.25)]),
    } as unknown as jest.Mocked<ExecutiveAiService>;
    const agent = new FinanceAgent(executiveAi);

    const answer = await agent.answer(ACTOR, "b1", "how is our margin?");

    expect(answer.agentKey).toBe("finance");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.5, 5);
    expect(executiveAi.revenueExplanation).toHaveBeenCalledWith(ACTOR, "b1");
  });
});
