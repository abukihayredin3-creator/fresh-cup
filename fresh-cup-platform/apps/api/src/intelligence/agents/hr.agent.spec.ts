import type { RequestUser } from "../../common/types/request-user.interface";
import type { WorkforceAiService } from "../services/workforce-ai/workforce-ai.service";
import { HrAgent } from "./hr.agent";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (confidence: number) => ({ title: "t", explanation: "e", confidence, data: {} });

describe("HrAgent", () => {
  it("combines scheduling and attendance insights", async () => {
    const workforceAi = {
      schedulingInsights: jest.fn().mockResolvedValue([insight(0.5)]),
      attendanceAnomalies: jest.fn().mockResolvedValue([insight(0.9)]),
    } as unknown as jest.Mocked<WorkforceAiService>;
    const agent = new HrAgent(workforceAi);

    const answer = await agent.answer(ACTOR, "b1", "any staffing gaps?");

    expect(answer.agentKey).toBe("hr");
    expect(answer.insights).toHaveLength(2);
    expect(answer.confidence).toBeCloseTo(0.7, 5);
  });
});
