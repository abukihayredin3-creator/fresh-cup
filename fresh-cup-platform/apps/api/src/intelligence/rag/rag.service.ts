import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { PrismaService } from "../../database/prisma.service";
import { EMBEDDING_PROVIDER_TOKEN } from "../embeddings/embedding-provider.factory";
import type { EmbeddingProvider } from "../embeddings/embedding-provider.interface";
import { VECTOR_PROVIDER_TOKEN } from "../vector/vector-provider.factory";
import type { VectorProvider, VectorQueryResult } from "../vector/vector-provider.interface";

const HYBRID_VECTOR_WEIGHT = 0.7;
const HYBRID_KEYWORD_WEIGHT = 0.3;

/**
 * Retrieval-Augmented Generation glue: embeds content via the configured
 * EmbeddingProvider and stores/searches it via the configured
 * VectorProvider. A no-op when AI_RAG_ENABLED=false — callers (chiefly
 * AiMemoryService) always call it the same way; the flag just decides
 * whether it does anything.
 */
@Injectable()
export class RagService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER_TOKEN) private readonly embeddings: EmbeddingProvider,
    @Inject(VECTOR_PROVIDER_TOKEN) private readonly vectors: VectorProvider,
  ) {}

  private get enabled(): boolean {
    return this.config.get("AI_RAG_ENABLED", { infer: true });
  }

  async index(
    namespace: string,
    id: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) return;
    const [embedding] = await this.embeddings.embed([content]);
    if (!embedding) return;
    await this.vectors.upsert(namespace, [{ id, embedding, content, metadata }]);
  }

  async retrieve(
    namespace: string,
    query: string,
    topK = 5,
    filter?: Record<string, unknown>,
  ): Promise<VectorQueryResult[]> {
    if (!this.enabled) return [];
    const [embedding] = await this.embeddings.embed([query]);
    if (!embedding) return [];
    return this.vectors.query(namespace, embedding, topK, filter);
  }

  /**
   * Hybrid Search (Phase 11 Part 3): blends semantic similarity from the
   * configured `VectorProvider` with a plain keyword match against
   * `VectorEntry.content` — Postgres `ILIKE`, not a remote provider call,
   * since this platform's only queryable text store is the table
   * `PgVectorProvider` writes to. When a remote provider (OpenSearch/
   * Pinecone/Qdrant) is configured, the keyword half naturally contributes
   * nothing for records it never indexed into `VectorEntry`, so hybrid
   * search degrades to vector-only ranking rather than throwing — a
   * documented behavior, not a bug.
   */
  async hybridRetrieve(
    namespace: string,
    query: string,
    topK = 5,
    filter?: Record<string, unknown>,
  ): Promise<VectorQueryResult[]> {
    if (!this.enabled) return [];
    const [semantic, keywordMatches] = await Promise.all([
      this.retrieve(namespace, query, Math.max(topK * 2, topK), filter),
      this.prisma.vectorEntry.findMany({
        where: { namespace, content: { contains: query, mode: "insensitive" } },
        take: topK * 2,
      }),
    ]);

    const keywordIds = new Set(keywordMatches.map((entry) => entry.id));
    const byId = new Map<string, VectorQueryResult>();
    for (const result of semantic) {
      byId.set(result.id, result);
    }
    for (const entry of keywordMatches) {
      if (!byId.has(entry.id)) {
        byId.set(entry.id, {
          id: entry.id,
          score: 0,
          content: entry.content ?? undefined,
          metadata: (entry.metadata as Record<string, unknown> | null) ?? undefined,
        });
      }
    }

    return Array.from(byId.values())
      .map((result) => ({
        ...result,
        score:
          result.score * HYBRID_VECTOR_WEIGHT +
          (keywordIds.has(result.id) ? HYBRID_KEYWORD_WEIGHT : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
