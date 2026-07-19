import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { EmbeddingProvider } from "../embeddings/embedding-provider.interface";
import type { VectorProvider } from "../vector/vector-provider.interface";
import { RagService } from "./rag.service";

function configWith(ragEnabled: boolean): ConfigService<EnvironmentVariables, true> {
  return { get: () => ragEnabled } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe("RagService", () => {
  function makeDeps() {
    const embeddings: jest.Mocked<EmbeddingProvider> = {
      name: "local",
      isConfigured: true,
      dimensions: 3,
      embed: jest.fn().mockResolvedValue([[1, 0, 0]]),
    };
    const vectors: jest.Mocked<VectorProvider> = {
      name: "pgvector",
      isConfigured: true,
      upsert: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ id: "v1", score: 0.9 }]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    return { embeddings, vectors };
  }

  it("does nothing when AI_RAG_ENABLED is false", async () => {
    const { embeddings, vectors } = makeDeps();
    const rag = new RagService(configWith(false), embeddings, vectors);

    await rag.index("ai-memory", "id1", "some content");
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(vectors.upsert).not.toHaveBeenCalled();

    const results = await rag.retrieve("ai-memory", "query");
    expect(results).toEqual([]);
    expect(vectors.query).not.toHaveBeenCalled();
  });

  it("embeds and upserts when enabled", async () => {
    const { embeddings, vectors } = makeDeps();
    const rag = new RagService(configWith(true), embeddings, vectors);

    await rag.index("ai-memory", "id1", "revenue is up", { domain: "executive" });

    expect(embeddings.embed).toHaveBeenCalledWith(["revenue is up"]);
    expect(vectors.upsert).toHaveBeenCalledWith("ai-memory", [
      {
        id: "id1",
        embedding: [1, 0, 0],
        content: "revenue is up",
        metadata: { domain: "executive" },
      },
    ]);
  });

  it("embeds the query and delegates to the vector provider when enabled", async () => {
    const { embeddings, vectors } = makeDeps();
    const rag = new RagService(configWith(true), embeddings, vectors);

    const results = await rag.retrieve("ai-memory", "how were sales", 3);

    expect(embeddings.embed).toHaveBeenCalledWith(["how were sales"]);
    expect(vectors.query).toHaveBeenCalledWith("ai-memory", [1, 0, 0], 3);
    expect(results).toEqual([{ id: "v1", score: 0.9 }]);
  });
});
