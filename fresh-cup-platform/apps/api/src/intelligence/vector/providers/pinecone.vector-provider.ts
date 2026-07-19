import type { VectorProvider, VectorQueryResult, VectorRecord } from "../vector-provider.interface";

interface PineconeQueryResponse {
  matches: { id: string; score: number; metadata?: Record<string, unknown> }[];
}

/** Fetch-based client for Pinecone's REST API (index host is data-plane-specific). */
export class PineconeVectorProvider implements VectorProvider {
  readonly name = "pinecone";
  readonly isConfigured: boolean;

  constructor(
    private readonly indexHost: string | undefined,
    private readonly apiKey: string | undefined,
  ) {
    this.isConfigured = Boolean(indexHost && apiKey);
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", "Api-Key": this.apiKey ?? "" };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        "PineconeVectorProvider used without PINECONE_API_KEY/PINECONE_INDEX_HOST configured",
      );
    }
  }

  async upsert(namespace: string, records: VectorRecord[]): Promise<void> {
    this.assertConfigured();
    const response = await fetch(`https://${this.indexHost}/vectors/upsert`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        namespace,
        vectors: records.map((r) => ({
          id: r.id,
          values: r.embedding,
          metadata: { content: r.content, ...r.metadata },
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Pinecone upsert failed: ${response.status} ${await response.text()}`);
    }
  }

  async query(namespace: string, embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    this.assertConfigured();
    const response = await fetch(`https://${this.indexHost}/query`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ namespace, vector: embedding, topK, includeMetadata: true }),
    });
    if (!response.ok) {
      throw new Error(`Pinecone query failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as PineconeQueryResponse;
    return body.matches.map((m) => ({
      id: m.id,
      score: m.score,
      content: m.metadata?.content as string | undefined,
      metadata: m.metadata,
    }));
  }

  async delete(namespace: string, ids: string[]): Promise<void> {
    this.assertConfigured();
    await fetch(`https://${this.indexHost}/vectors/delete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ namespace, ids }),
    });
  }
}
