import type { VectorProvider, VectorQueryResult, VectorRecord } from "../vector-provider.interface";

interface OpenSearchHit {
  _id: string;
  _score: number;
  _source: { content?: string; metadata?: Record<string, unknown> };
}

interface OpenSearchSearchResponse {
  hits: { hits: OpenSearchHit[] };
}

/** Fetch-based client for OpenSearch's k-NN vector search REST API. */
export class OpenSearchVectorProvider implements VectorProvider {
  readonly name = "opensearch";
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
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error("OpenSearchVectorProvider used without OPENSEARCH_URL configured");
    }
  }

  async upsert(namespace: string, records: VectorRecord[]): Promise<void> {
    this.assertConfigured();
    const body = records
      .flatMap((record) => [
        JSON.stringify({ index: { _index: namespace, _id: record.id } }),
        JSON.stringify({
          embedding: record.embedding,
          content: record.content,
          metadata: record.metadata,
        }),
      ])
      .join("\n");
    const response = await fetch(`${this.baseUrl}/_bulk`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/x-ndjson" },
      body: `${body}\n`,
    });
    if (!response.ok) {
      throw new Error(`OpenSearch bulk upsert failed: ${response.status} ${await response.text()}`);
    }
  }

  async query(
    namespace: string,
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorQueryResult[]> {
    this.assertConfigured();
    const filterClauses = Object.entries(filter ?? {}).map(([key, value]) => ({
      term: { [`metadata.${key}`]: value },
    }));
    const response = await fetch(`${this.baseUrl}/${namespace}/_search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        size: topK,
        query: { knn: { embedding: { vector: embedding, k: topK } } },
        ...(filterClauses.length > 0 ? { post_filter: { bool: { filter: filterClauses } } } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenSearch query failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as OpenSearchSearchResponse;
    return body.hits.hits.map((hit) => ({
      id: hit._id,
      score: hit._score,
      content: hit._source.content,
      metadata: hit._source.metadata,
    }));
  }

  async delete(namespace: string, ids: string[]): Promise<void> {
    this.assertConfigured();
    const body = ids
      .map((id) => JSON.stringify({ delete: { _index: namespace, _id: id } }))
      .join("\n");
    await fetch(`${this.baseUrl}/_bulk`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/x-ndjson" },
      body: `${body}\n`,
    });
  }
}
