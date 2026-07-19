import type { RequestUser } from "../../common/types/request-user.interface";
import type { MarketingAiService } from "../services/marketing-ai/marketing-ai.service";
import { MarketingAgent } from "./marketing.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("MarketingAgent", () => {
  it("combines campaign and coupon insights", async () => {
    const marketingAi = {
      campaignRecommendations: jest.fn().mockResolvedValue([insight(0.8)]),
      couponOptimization: jest.fn().mockResolvedValue([insight(0.6)]),
    } as unknown as jest.Mocked<MarketingAiService>;
    const agent = new MarketingAgent(marketingAi);

    const answer = await agent.answer(ACTOR, undefined, "any coupon ideas?");

    expect(answer.agentKey).toBe("marketing");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.7, 5);
    expect(marketingAi.campaignRecommendations).toHaveBeenCalledWith(ACTOR);
  });
});
