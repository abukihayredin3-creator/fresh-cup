export interface VectorRecord {
  id: string;
  embedding: number[];
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provider-agnostic vector index. `namespace` partitions unrelated
 * indexes within one store (e.g. "ai-memory") — external providers map it
 * to an index/collection name, PgVectorProvider maps it to a column value.
 */
export interface VectorProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  upsert(namespace: string, records: VectorRecord[]): Promise<void>;
  /**
   * `filter` is an exact-match AND filter over each record's `metadata` —
   * "Metadata Filtering" from the Phase 11 Part 3 spec. Every provider
   * implements it against its own native filter syntax; `PgVectorProvider`
   * (the default) is the one exercised by this app's test suite and CI.
   */
  query(
    namespace: string,
    embedding: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorQueryResult[]>;
  delete(namespace: string, ids: string[]): Promise<void>;
}
