import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
import { createVectorProvider } from "./vector-provider.factory";
import { OpenSearchVectorProvider } from "./providers/opensearch.vector-provider";
import { PgVectorProvider } from "./providers/pgvector.vector-provider";
import { PineconeVectorProvider } from "./providers/pinecone.vector-provider";
import { QdrantVectorProvider } from "./providers/qdrant.vector-provider";

function configWith(
  values: Record<string, string | undefined>,
): ConfigService<EnvironmentVariables, true> {
  return { get: (key: string) => values[key] } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
}

const fakePrisma = {} as PrismaService;

describe("createVectorProvider", () => {
  it("defaults to PgVectorProvider", () => {
    expect(createVectorProvider(configWith({}), fakePrisma)).toBeInstanceOf(PgVectorProvider);
  });

  it("builds OpenSearch/Pinecone/Qdrant providers by VECTOR_PROVIDER", () => {
    expect(
      createVectorProvider(
        configWith({ VECTOR_PROVIDER: "opensearch", OPENSEARCH_URL: "http://os" }),
        fakePrisma,
      ),
    ).toBeInstanceOf(OpenSearchVectorProvider);
    expect(
      createVectorProvider(
        configWith({
          VECTOR_PROVIDER: "pinecone",
          PINECONE_API_KEY: "pk",
          PINECONE_INDEX_HOST: "host",
        }),
        fakePrisma,
      ),
    ).toBeInstanceOf(PineconeVectorProvider);
    expect(
      createVectorProvider(
        configWith({ VECTOR_PROVIDER: "qdrant", QDRANT_URL: "http://qd" }),
        fakePrisma,
      ),
    ).toBeInstanceOf(QdrantVectorProvider);
  });
});
