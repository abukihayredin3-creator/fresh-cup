import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { createEmbeddingProvider } from "./embedding-provider.factory";
import { CohereEmbeddingProvider } from "./providers/cohere.embedding-provider";
import { LocalEmbeddingProvider } from "./providers/local.embedding-provider";
import { OpenAiEmbeddingProvider } from "./providers/openai.embedding-provider";
import { VoyageEmbeddingProvider } from "./providers/voyage.embedding-provider";

function configWith(
  values: Record<string, string | undefined>,
): ConfigService<EnvironmentVariables, true> {
  return { get: (key: string) => values[key] } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
}

describe("createEmbeddingProvider", () => {
  it("defaults to LocalEmbeddingProvider", () => {
    expect(createEmbeddingProvider(configWith({}))).toBeInstanceOf(LocalEmbeddingProvider);
  });

  it("builds OpenAI/Voyage/Cohere providers by EMBEDDING_PROVIDER", () => {
    expect(
      createEmbeddingProvider(configWith({ EMBEDDING_PROVIDER: "openai", OPENAI_API_KEY: "sk" })),
    ).toBeInstanceOf(OpenAiEmbeddingProvider);
    expect(
      createEmbeddingProvider(configWith({ EMBEDDING_PROVIDER: "voyage", VOYAGE_API_KEY: "vk" })),
    ).toBeInstanceOf(VoyageEmbeddingProvider);
    expect(
      createEmbeddingProvider(configWith({ EMBEDDING_PROVIDER: "cohere", COHERE_API_KEY: "ck" })),
    ).toBeInstanceOf(CohereEmbeddingProvider);
  });
});
