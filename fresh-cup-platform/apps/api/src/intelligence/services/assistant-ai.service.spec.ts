import type { RequestUser } from "../../common/types/request-user.interface";
import type { AiMemoryService } from "../memory/ai-memory.service";
import { AssistantAiService } from "./assistant-ai.service";
import type { AgentRunnerService } from "./agent-runner.service";
import type { CustomerAiService } from "./customer-ai/customer-ai.service";
import type { ExecutiveAiService } from "./executive-ai/executive-ai.service";
import type { InventoryAiService } from "./inventory-ai/inventory-ai.service";
import type { SalesAiService } from "./sales-ai/sales-ai.service";

const actor: RequestUser = { id: "user-1", role: "MANAGER" as never, branchId: null };

describe("AssistantAiService", () => {
  function makeService(runResult: { text: string; toolCalls: unknown[]; usedLlm: boolean }) {
    const agentRunner = {
      run: jest.fn().mockResolvedValue(runResult),
    } as unknown as jest.Mocked<AgentRunnerService>;
    const memory = {
      remember: jest.fn().mockResolvedValue("mem-1"),
    } as unknown as jest.Mocked<AiMemoryService>;
    const executiveAi = {} as ExecutiveAiService;
    const customerAi = {} as CustomerAiService;
    const inventoryAi = {} as InventoryAiService;
    const salesAi = {} as SalesAiService;

    const service = new AssistantAiService(
      agentRunner,
      memory,
      executiveAi,
      customerAi,
      inventoryAi,
      salesAi,
    );
    return { service, agentRunner, memory };
  }

  it("returns the LLM's answer and persists the exchange to memory", async () => {
    const { service, memory } = makeService({
      text: "Revenue was strong.",
      toolCalls: [],
      usedLlm: true,
    });
    const result = await service.ask(actor, "how were sales today?", "branch-1");

    expect(result.answer).toBe("Revenue was strong.");
    expect(result.memoryEntryId).toBe("mem-1");
    expect(memory.remember).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "assistant",
        authorUserId: "user-1",
        branchId: "branch-1",
      }),
    );
  });

  it("falls back to a data-found message when there's no LLM text but tool calls ran", async () => {
    const { service } = makeService({
      text: "",
      toolCalls: [{ tool: "get_daily_summary", input: {}, result: {} }],
      usedLlm: false,
    });
    const result = await service.ask(actor, "how were sales today?");
    expect(result.answer).toContain("found");
  });

  it("tells the manager to configure LLM_PROVIDER when nothing ran at all", async () => {
    const { service } = makeService({ text: "", toolCalls: [], usedLlm: false });
    const result = await service.ask(actor, "how were sales today?");
    expect(result.answer).toContain("LLM_PROVIDER");
  });
});
