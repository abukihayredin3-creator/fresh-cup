import type { EmbeddingProvider } from "../embedding-provider.interface";

const DIMENSIONS = 256;

/** FNV-1a — deterministic, dependency-free, fast enough for short strings. */
function hash(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Zero-dependency default: a deterministic hashed bag-of-words vector
 * (the embedding equivalent of Phase 6's hand-rolled statistics — no
 * external API, no model weights to ship). Good enough for the exact/
 * near-duplicate recall RAG needs in this app; swap EMBEDDING_PROVIDER to
 * openai/voyage/cohere for real semantic embeddings in production.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly isConfigured = true;
  readonly dimensions = DIMENSIONS;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(DIMENSIONS).fill(0);
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    for (const token of tokens) {
      const index = hash(token) % DIMENSIONS;
      vector[index] = (vector[index] ?? 0) + 1;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map((v) => v / magnitude);
  }
}
