import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { LlmProvider } from "./llm-provider.interface";
import { AnthropicLlmProvider } from "./providers/anthropic.llm-provider";
import { GeminiLlmProvider } from "./providers/gemini.llm-provider";
import { NullLlmProvider } from "./providers/null.llm-provider";
import { OpenAiCompatibleLlmProvider } from "./providers/openai-compatible.llm-provider";

export const LLM_PROVIDER_TOKEN = "LLM_PROVIDER_TOKEN";

/**
 * Reads LLM_PROVIDER (+ the matching provider's own env vars) and returns
 * the concrete implementation — the only place in the codebase that knows
 * which provider is active. Every consumer (AgentRunnerService, domain AI
 * services) depends on the LlmProvider interface only, so switching
 * providers is a config change, never a code change.
 */
export function createLlmProvider(config: ConfigService<EnvironmentVariables, true>): LlmProvider {
  const provider = config.get("LLM_PROVIDER", { infer: true });
  const model = config.get("LLM_MODEL", { infer: true });

  switch (provider) {
    case "anthropic":
      return new AnthropicLlmProvider(
        config.get("ANTHROPIC_API_KEY", { infer: true }),
        model || "claude-opus-4-8",
      );
    case "openai":
      return new OpenAiCompatibleLlmProvider(
        "openai",
        config.get("OPENAI_BASE_URL", { infer: true }) || "https://api.openai.com/v1",
        config.get("OPENAI_API_KEY", { infer: true }),
        model || "gpt-4o",
      );
    case "azure-openai": {
      const endpoint = config.get("AZURE_OPENAI_ENDPOINT", { infer: true });
      const deployment = config.get("AZURE_OPENAI_DEPLOYMENT", { infer: true });
      return new OpenAiCompatibleLlmProvider(
        "azure-openai",
        endpoint && deployment ? `${endpoint}/openai/deployments/${deployment}` : "",
        config.get("AZURE_OPENAI_API_KEY", { infer: true }),
        model || deployment || "",
        true,
        "api-key",
        "?api-version=2024-10-21",
      );
    }
    case "openrouter":
      return new OpenAiCompatibleLlmProvider(
        "openrouter",
        config.get("OPENROUTER_BASE_URL", { infer: true }) || "https://openrouter.ai/api/v1",
        config.get("OPENROUTER_API_KEY", { infer: true }),
        model || "anthropic/claude-opus-4-8",
      );
    case "ollama":
      return new OpenAiCompatibleLlmProvider(
        "ollama",
        config.get("OLLAMA_BASE_URL", { infer: true }) || "http://localhost:11434/v1",
        undefined,
        model || "llama3.1",
        false,
      );
    case "gemini":
      return new GeminiLlmProvider(
        config.get("GEMINI_API_KEY", { infer: true }),
        model || "gemini-2.0-flash",
      );
    case "none":
    default:
      return new NullLlmProvider();
  }
}
