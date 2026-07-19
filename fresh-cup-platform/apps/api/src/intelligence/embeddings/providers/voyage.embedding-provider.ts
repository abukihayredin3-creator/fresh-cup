import type { EmbeddingProvider } from "../embedding-provider.interface";

interface VoyageEmbeddingResponse {
  data: { embedding: number[] }[];
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly isConfigured: boolean;
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string = "voyage-3",
    private readonly baseUrl: string = "https://api.voyageai.com/v1",
  ) {
    this.isConfigured = Boolean(apiKey);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) {
      throw new Error("VoyageEmbeddingProvider used without VOYAGE_API_KEY configured");
    }
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(
        `Voyage embeddings request failed: ${response.status} ${await response.text()}`,
      );
    }
    const body = (await response.json()) as VoyageEmbeddingResponse;
    return body.data.map((d) => d.embedding);
  }
}
