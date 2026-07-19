import type { RequestUser } from "../../common/types/request-user.interface";
import type { InventoryAiService } from "../services/inventory-ai/inventory-ai.service";
import { InventoryAgent } from "./inventory.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("InventoryAgent", () => {
  it("combines restocking and waste insights", async () => {
    const inventoryAi = {
      restockingRecommendations: jest.fn().mockResolvedValue([insight(1)]),
      wastePrediction: jest.fn().mockResolvedValue([insight(0.4)]),
    } as unknown as jest.Mocked<InventoryAiService>;
    const agent = new InventoryAgent(inventoryAi);

    const answer = await agent.answer(ACTOR, "b1", "what should we reorder?");

    expect(answer.agentKey).toBe("inventory");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.7, 5);
  });
});
