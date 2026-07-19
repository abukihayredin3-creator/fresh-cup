import type { LlmProvider } from "../llm/llm-provider.interface";
import { AiSecurityService } from "./ai-security.service";
import { ExplanationService } from "./explanation.service";

describe("ExplanationService", () => {
  it("falls back to a deterministic template when no LLM is configured", async () => {
    const llm: LlmProvider = {
      name: "none",
      isConfigured: false,
      complete: jest.fn(),
    };
    const service = new ExplanationService(llm, new AiSecurityService());

    const explanation = await service.explain("Revenue trend", {
      totalRevenue: 45000.5,
      totalOrders: 120,
    });

    expect(explanation).toContain("Revenue trend");
    expect(explanation).toContain("totalRevenue: 45000.50");
    expect(explanation).toContain("totalOrders: 120");
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("uses the LLM provider when configured, and redacts its output", async () => {
    const llm: LlmProvider = {
      name: "anthropic",
      isConfigured: true,
      complete: jest.fn().mockResolvedValue({
        text: "Revenue rose thanks to strong weekend sales (key sk-ant-abcdefghijklmnopqrstuvwx).",
        toolCalls: [],
        stopReason: "end_turn",
      }),
    };
    const service = new ExplanationService(llm, new AiSecurityService());

    const explanation = await service.explain("Revenue trend", { totalRevenue: 45000 });

    expect(llm.complete).toHaveBeenCalled();
    expect(explanation).toContain("Revenue rose thanks to strong weekend sales");
    expect(explanation).not.toContain("sk-ant-");
  });

  it("falls back to the template when the LLM call throws", async () => {
    const llm: LlmProvider = {
      name: "anthropic",
      isConfigured: true,
      complete: jest.fn().mockRejectedValue(new Error("network error")),
    };
    const service = new ExplanationService(llm, new AiSecurityService());

    const explanation = await service.explain("Revenue trend", { totalRevenue: 100 });
    expect(explanation).toContain("totalRevenue: 100");
  });
});
