import type { VectorProvider, VectorQueryResult, VectorRecord } from "../vector-provider.interface";

interface QdrantSearchResponse {
  result: { id: string; score: number; payload?: Record<string, unknown> }[];
}

/** Fetch-based client for Qdrant's REST API. */
export class QdrantVectorProvider implements VectorProvider {
  readonly name = "qdrant";
  readonly isConfigured: boolean;

  constructor(
    private readonly baseUrl: string | undefined,
    private readonly apiKey: string | undefined,
  ) {
    this.isConfigured = Boolean(baseUrl);
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "api-key": this.apiKey } : {}),
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error("QdrantVectorProvider used without QDRANT_URL configured");
    }
  }

  async upsert(namespace: string, records: VectorRecord[]): Promise<void> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/collections/${namespace}/points`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        points: records.map((r) => ({
          id: r.id,
          vector: r.embedding,
          payload: { content: r.content, ...r.metadata },
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Qdrant upsert failed: ${response.status} ${await response.text()}`);
    }
  }

  async query(namespace: string, embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/collections/${namespace}/points/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ vector: embedding, limit: topK, with_payload: true }),
    });
    if (!response.ok) {
      throw new Error(`Qdrant query failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as QdrantSearchResponse;
    return body.result.map((r) => ({
      id: r.id,
      score: r.score,
      content: r.payload?.content as string | undefined,
      metadata: r.payload,
    }));
  }

  async delete(namespace: string, ids: string[]): Promise<void> {
    this.assertConfigured();
    await fetch(`${this.baseUrl}/collections/${namespace}/points/delete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ points: ids }),
    });
  }
}
