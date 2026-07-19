import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
import type { VectorProvider } from "./vector-provider.interface";
import { OpenSearchVectorProvider } from "./providers/opensearch.vector-provider";
import { PgVectorProvider } from "./providers/pgvector.vector-provider";
import { PineconeVectorProvider } from "./providers/pinecone.vector-provider";
import { QdrantVectorProvider } from "./providers/qdrant.vector-provider";

export const VECTOR_PROVIDER_TOKEN = "VECTOR_PROVIDER_TOKEN";

export function createVectorProvider(
  config: ConfigService<EnvironmentVariables, true>,
  prisma: PrismaService,
): VectorProvider {
  const provider = config.get("VECTOR_PROVIDER", { infer: true });

  switch (provider) {
    case "opensearch":
      return new OpenSearchVectorProvider(
        config.get("OPENSEARCH_URL", { infer: true }),
        config.get("OPENSEARCH_API_KEY", { infer: true }),
      );
    case "pinecone":
      return new PineconeVectorProvider(
        config.get("PINECONE_INDEX_HOST", { infer: true }),
        config.get("PINECONE_API_KEY", { infer: true }),
      );
    case "qdrant":
      return new QdrantVectorProvider(
        config.get("QDRANT_URL", { infer: true }),
        config.get("QDRANT_API_KEY", { infer: true }),
      );
    case "pgvector":
    default:
      return new PgVectorProvider(prisma);
  }
}
