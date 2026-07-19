import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { EMBEDDING_PROVIDER_TOKEN } from "../embeddings/embedding-provider.factory";
import type { EmbeddingProvider } from "../embeddings/embedding-provider.interface";
import { VECTOR_PROVIDER_TOKEN } from "../vector/vector-provider.factory";
import type { VectorProvider, VectorQueryResult } from "../vector/vector-provider.interface";

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

  async retrieve(namespace: string, query: string, topK = 5): Promise<VectorQueryResult[]> {
    if (!this.enabled) return [];
    const [embedding] = await this.embeddings.embed([query]);
    if (!embedding) return [];
    return this.vectors.query(namespace, embedding, topK);
  }
}
