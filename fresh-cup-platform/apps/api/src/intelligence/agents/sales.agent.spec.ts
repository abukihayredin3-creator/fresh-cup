import type { RequestUser } from "../../common/types/request-user.interface";
import type { SalesAiService } from "../services/sales-ai/sales-ai.service";
import { SalesAgent } from "./sales.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("SalesAgent", () => {
  it("combines demand/best-seller/peak-hour insights with an averaged confidence", async () => {
    const salesAi = {
      demandForecast: jest.fn().mockResolvedValue(insight(0.9)),
      bestSellerPrediction: jest.fn().mockResolvedValue(insight(0.7)),
      peakHourPrediction: jest.fn().mockResolvedValue(insight(0.5)),
    } as unknown as jest.Mocked<SalesAiService>;
    const agent = new SalesAgent(salesAi);

    const answer = await agent.answer(ACTOR, "b1", "what's our sales forecast?");

    expect(answer.agentKey).toBe("sales");
    expect(answer.insights).toHaveLength(3);
    expect(answer.confidence).toBeCloseTo(0.7, 5);
    expect(salesAi.demandForecast).toHaveBeenCalledWith("b1");
  });
});
