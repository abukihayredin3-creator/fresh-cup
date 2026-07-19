import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
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
    const prisma = {
      vectorEntry: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;
    return { embeddings, vectors, prisma };
  }

  it("does nothing when AI_RAG_ENABLED is false", async () => {
    const { embeddings, vectors, prisma } = makeDeps();
    const rag = new RagService(configWith(false), prisma, embeddings, vectors);

    await rag.index("ai-memory", "id1", "some content");
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(vectors.upsert).not.toHaveBeenCalled();

    const results = await rag.retrieve("ai-memory", "query");
    expect(results).toEqual([]);
    expect(vectors.query).not.toHaveBeenCalled();

    const hybridResults = await rag.hybridRetrieve("ai-memory", "query");
    expect(hybridResults).toEqual([]);
  });

  it("embeds and upserts when enabled", async () => {
    const { embeddings, vectors, prisma } = makeDeps();
    const rag = new RagService(configWith(true), prisma, embeddings, vectors);

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
    const { embeddings, vectors, prisma } = makeDeps();
    const rag = new RagService(configWith(true), prisma, embeddings, vectors);

    const results = await rag.retrieve("ai-memory", "how were sales", 3);

    expect(embeddings.embed).toHaveBeenCalledWith(["how were sales"]);
    expect(vectors.query).toHaveBeenCalledWith("ai-memory", [1, 0, 0], 3, undefined);
    expect(results).toEqual([{ id: "v1", score: 0.9 }]);
  });

  it("passes a metadata filter through to the vector provider", async () => {
    const { embeddings, vectors, prisma } = makeDeps();
    const rag = new RagService(configWith(true), prisma, embeddings, vectors);

    await rag.retrieve("ai-memory", "how were sales", 3, { domain: "executive" });
    expect(vectors.query).toHaveBeenCalledWith("ai-memory", [1, 0, 0], 3, { domain: "executive" });
  });

  describe("deleteIndexed", () => {
    it("does nothing when RAG is disabled", async () => {
      const { embeddings, vectors, prisma } = makeDeps();
      const rag = new RagService(configWith(false), prisma, embeddings, vectors);
      await rag.deleteIndexed("ai-knowledge-base", ["doc-1"]);
      expect(vectors.delete).not.toHaveBeenCalled();
    });

    it("delegates to the vector provider when enabled", async () => {
      const { embeddings, vectors, prisma } = makeDeps();
      const rag = new RagService(configWith(true), prisma, embeddings, vectors);
      await rag.deleteIndexed("ai-knowledge-base", ["doc-1"]);
      expect(vectors.delete).toHaveBeenCalledWith("ai-knowledge-base", ["doc-1"]);
    });
  });

  describe("hybridRetrieve", () => {
    it("blends semantic and keyword matches, ranking overlap highest", async () => {
      const { embeddings, vectors, prisma } = makeDeps();
      (vectors.query as jest.Mock).mockResolvedValue([
        { id: "v1", score: 0.9 },
        { id: "v2", score: 0.5 },
      ]);
      (prisma.vectorEntry.findMany as jest.Mock).mockResolvedValue([
        { id: "v1", content: "revenue is up", metadata: null },
        { id: "v3", content: "revenue is up this week", metadata: null },
      ]);
      const rag = new RagService(configWith(true), prisma, embeddings, vectors);

      const results = await rag.hybridRetrieve("ai-memory", "revenue", 3);

      // v1: semantic (0.9*0.7) + keyword (0.3) = 0.93
      // v2: semantic only (0.5*0.7) = 0.35
      // v3: keyword only = 0.3
      expect(results.map((r) => r.id)).toEqual(["v1", "v2", "v3"]);
      expect(results[0]!.score).toBeCloseTo(0.93, 5);
    });

    it("returns an empty array when RAG is disabled", async () => {
      const { embeddings, vectors, prisma } = makeDeps();
      const rag = new RagService(configWith(false), prisma, embeddings, vectors);
      expect(await rag.hybridRetrieve("ai-memory", "revenue")).toEqual([]);
      expect(prisma.vectorEntry.findMany).not.toHaveBeenCalled();
    });
  });
});
