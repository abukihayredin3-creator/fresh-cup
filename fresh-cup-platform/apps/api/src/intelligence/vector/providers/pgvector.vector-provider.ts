import type { PrismaService } from "../../../database/prisma.service";
import { cosineSimilarity } from "../../utils/cosine-similarity.util";
import type { VectorProvider, VectorQueryResult, VectorRecord } from "../vector-provider.interface";

/**
 * Default VECTOR_PROVIDER — no external service, no Postgres extension.
 * Stores embeddings as a native Postgres `double precision[]` column
 * (`VectorEntry.embedding`) and computes cosine similarity in application
 * code for `query()`. Fine at this app's memory-entry volume; swap to
 * OpenSearch/Pinecone/Qdrant for ANN search at real scale.
 */
export class PgVectorProvider implements VectorProvider {
  readonly name = "pgvector";
  readonly isConfigured = true;

  constructor(private readonly prisma: PrismaService) {}

  async upsert(namespace: string, records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      await this.prisma.vectorEntry.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          namespace,
          embedding: record.embedding,
          content: record.content,
          metadata: record.metadata as never,
        },
        update: {
          embedding: record.embedding,
          content: record.content,
          metadata: record.metadata as never,
        },
      });
    }
  }

  async query(
    namespace: string,
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorQueryResult[]> {
    const metadataConditions = Object.entries(filter ?? {}).map(([key, value]) => ({
      metadata: { path: [key], equals: value } as never,
    }));
    const candidates = await this.prisma.vectorEntry.findMany({
      where: { namespace, AND: metadataConditions.length > 0 ? metadataConditions : undefined },
    });
    return candidates
      .map((c) => ({
        id: c.id,
        score: cosineSimilarity(embedding, c.embedding),
        content: c.content ?? undefined,
        metadata: (c.metadata as Record<string, unknown> | null) ?? undefined,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async delete(namespace: string, ids: string[]): Promise<void> {
    await this.prisma.vectorEntry.deleteMany({ where: { namespace, id: { in: ids } } });
  }
}
