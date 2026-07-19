import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { EmbeddingProvider } from "./embedding-provider.interface";
import { CohereEmbeddingProvider } from "./providers/cohere.embedding-provider";
import { LocalEmbeddingProvider } from "./providers/local.embedding-provider";
import { OpenAiEmbeddingProvider } from "./providers/openai.embedding-provider";
import { VoyageEmbeddingProvider } from "./providers/voyage.embedding-provider";

export const EMBEDDING_PROVIDER_TOKEN = "EMBEDDING_PROVIDER_TOKEN";

export function createEmbeddingProvider(
  config: ConfigService<EnvironmentVariables, true>,
): EmbeddingProvider {
  const provider = config.get("EMBEDDING_PROVIDER", { infer: true });
  const model = config.get("EMBEDDING_MODEL", { infer: true });

  switch (provider) {
    case "openai":
      return new OpenAiEmbeddingProvider(
        config.get("OPENAI_API_KEY", { infer: true }),
        model || undefined,
      );
    case "voyage":
      return new VoyageEmbeddingProvider(
        config.get("VOYAGE_API_KEY", { infer: true }),
        model || undefined,
      );
    case "cohere":
      return new CohereEmbeddingProvider(
        config.get("COHERE_API_KEY", { infer: true }),
        model || undefined,
      );
    case "local":
    default:
      return new LocalEmbeddingProvider();
  }
}
