import type { RequestUser } from "../../common/types/request-user.interface";
import type { KitchenAiService } from "../services/kitchen-ai/kitchen-ai.service";
import { KitchenAgent } from "./kitchen.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("KitchenAgent", () => {
  it("combines bottleneck and workload insights", async () => {
    const kitchenAi = {
      prepBottlenecks: jest.fn().mockResolvedValue([insight(0.6)]),
      stationWorkload: jest.fn().mockResolvedValue([insight(0.8)]),
    } as unknown as jest.Mocked<KitchenAiService>;
    const agent = new KitchenAgent(kitchenAi);

    const answer = await agent.answer(ACTOR, "b1", "any kitchen bottlenecks?");

    expect(answer.agentKey).toBe("kitchen");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.7, 5);
  });
});
