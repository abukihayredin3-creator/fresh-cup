import type { RequestUser } from "../../common/types/request-user.interface";
import type { DeliveryAiService } from "../services/delivery-ai/delivery-ai.service";
import { DeliveryAgent } from "./delivery.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("DeliveryAgent", () => {
  it("combines delay and zone insights", async () => {
    const deliveryAi = {
      delayDetection: jest.fn().mockResolvedValue([insight(0.3)]),
      zoneOptimization: jest.fn().mockResolvedValue([insight(0.9)]),
    } as unknown as jest.Mocked<DeliveryAiService>;
    const agent = new DeliveryAgent(deliveryAi);

    const answer = await agent.answer(ACTOR, "b1", "any delivery delays?");

    expect(answer.agentKey).toBe("delivery");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.6, 5);
  });
});
