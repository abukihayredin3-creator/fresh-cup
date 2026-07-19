import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { createLlmProvider } from "./llm-provider.factory";
import { AnthropicLlmProvider } from "./providers/anthropic.llm-provider";
import { GeminiLlmProvider } from "./providers/gemini.llm-provider";
import { NullLlmProvider } from "./providers/null.llm-provider";
import { OpenAiCompatibleLlmProvider } from "./providers/openai-compatible.llm-provider";

function configWith(
  values: Record<string, string | undefined>,
): ConfigService<EnvironmentVariables, true> {
  return { get: (key: string) => values[key] } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
}

describe("createLlmProvider", () => {
  it("defaults to NullLlmProvider when LLM_PROVIDER is unset", () => {
    const provider = createLlmProvider(configWith({}));
    expect(provider).toBeInstanceOf(NullLlmProvider);
    expect(provider.isConfigured).toBe(false);
  });

  it("builds an AnthropicLlmProvider for LLM_PROVIDER=anthropic", () => {
    const provider = createLlmProvider(
      configWith({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-test" }),
    );
    expect(provider).toBeInstanceOf(AnthropicLlmProvider);
    expect(provider.isConfigured).toBe(true);
  });

  it("builds an unconfigured AnthropicLlmProvider when no key is set", () => {
    const provider = createLlmProvider(configWith({ LLM_PROVIDER: "anthropic" }));
    expect(provider).toBeInstanceOf(AnthropicLlmProvider);
    expect(provider.isConfigured).toBe(false);
  });

  it("builds an OpenAiCompatibleLlmProvider for openai/azure-openai/openrouter/ollama", () => {
    expect(
      createLlmProvider(configWith({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" })),
    ).toBeInstanceOf(OpenAiCompatibleLlmProvider);
    expect(
      createLlmProvider(
        configWith({
          LLM_PROVIDER: "azure-openai",
          AZURE_OPENAI_API_KEY: "key",
          AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
          AZURE_OPENAI_DEPLOYMENT: "gpt-4o",
        }),
      ),
    ).toBeInstanceOf(OpenAiCompatibleLlmProvider);
    expect(createLlmProvider(configWith({ LLM_PROVIDER: "openrouter" }))).toBeInstanceOf(
      OpenAiCompatibleLlmProvider,
    );
    const ollama = createLlmProvider(configWith({ LLM_PROVIDER: "ollama" }));
    expect(ollama).toBeInstanceOf(OpenAiCompatibleLlmProvider);
    // Ollama needs no API key to be considered configured.
    expect(ollama.isConfigured).toBe(true);
  });

  it("builds a GeminiLlmProvider for LLM_PROVIDER=gemini", () => {
    const provider = createLlmProvider(
      configWith({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g-key" }),
    );
    expect(provider).toBeInstanceOf(GeminiLlmProvider);
    expect(provider.isConfigured).toBe(true);
  });
});
