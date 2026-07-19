import type { EmbeddingProvider } from "../embedding-provider.interface";

interface CohereEmbeddingResponse {
  embeddings: { float: number[][] };
}

export class CohereEmbeddingProvider implements EmbeddingProvider {
  readonly name = "cohere";
  readonly isConfigured: boolean;
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string = "embed-v4.0",
    private readonly baseUrl: string = "https://api.cohere.com/v2",
  ) {
    this.isConfigured = Boolean(apiKey);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) {
      throw new Error("CohereEmbeddingProvider used without COHERE_API_KEY configured");
    }
    const response = await fetch(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        texts,
        input_type: "search_document",
        embedding_types: ["float"],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Cohere embeddings request failed: ${response.status} ${await response.text()}`,
      );
    }
    const body = (await response.json()) as CohereEmbeddingResponse;
    return body.embeddings.float;
  }
}
