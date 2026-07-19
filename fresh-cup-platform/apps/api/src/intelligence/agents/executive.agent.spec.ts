import type { RequestUser } from "../../common/types/request-user.interface";
import type { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";
import { ExecutiveAgent } from "./executive.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("ExecutiveAgent", () => {
  it("combines daily summary and risk-detection insights", async () => {
    const executiveAi = {
      dailySummary: jest.fn().mockResolvedValue(insight(0.8)),
      riskDetection: jest.fn().mockResolvedValue([insight(0.2)]),
    } as unknown as jest.Mocked<ExecutiveAiService>;
    const agent = new ExecutiveAgent(executiveAi);

    const answer = await agent.answer(ACTOR, "b1", "how was today?");

    expect(answer.agentKey).toBe("executive");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.5, 5);
    expect(executiveAi.dailySummary).toHaveBeenCalledWith(ACTOR, "b1");
  });
});
