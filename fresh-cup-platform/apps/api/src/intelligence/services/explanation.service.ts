import { Inject, Injectable } from "@nestjs/common";
import { LLM_PROVIDER_TOKEN } from "../llm/llm-provider.factory";
import type { LlmProvider } from "../llm/llm-provider.interface";
import { AI_GUARDRAIL_PREAMBLE } from "../prompts/system-prompts";
import { sanitizeForPrompt } from "../prompts/prompt-sanitizer.util";
import { AiSecurityService } from "./ai-security.service";

/**
 * Turns a set of already-computed data points into a short natural-
 * language explanation (Core Principle 2: every recommendation must
 * include an explanation). Uses the configured LlmProvider when one is
 * available; otherwise falls back to a deterministic "key: value" sentence
 * built directly from the same data — no LLM required to satisfy the
 * "always explain" requirement, only to make the phrasing nicer.
 */
@Injectable()
export class ExplanationService {
  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly llm: LlmProvider,
    private readonly security: AiSecurityService,
  ) {}

  async explain(topic: string, dataPoints: Record<string, unknown>): Promise<string> {
    if (!this.llm.isConfigured) {
      return this.templateExplain(topic, dataPoints);
    }

    try {
      const response = await this.llm.complete({
        system: `${AI_GUARDRAIL_PREAMBLE}\n\nWrite a single short (1-3 sentence) explanation of the finding below, using only the numbers given — do not invent any figure not present in the data.`,
        messages: [
          {
            role: "user",
            content: sanitizeForPrompt(`Topic: ${topic}\nData: ${JSON.stringify(dataPoints)}`),
          },
        ],
        maxTokens: 200,
      });
      return this.security.redact(response.text ?? this.templateExplain(topic, dataPoints));
    } catch {
      return this.templateExplain(topic, dataPoints);
    }
  }

  private templateExplain(topic: string, dataPoints: Record<string, unknown>): string {
    const parts = Object.entries(dataPoints)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${this.formatValue(value)}`);
    return `${topic} — ${parts.join(", ")}.`;
  }

  private formatValue(value: unknown): string {
    if (typeof value === "number")
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return String(value);
  }
}
