import type { EmbeddingProvider } from "../embedding-provider.interface";

interface OpenAiEmbeddingResponse {
  data: { embedding: number[] }[];
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly isConfigured: boolean;
  readonly dimensions = 1536;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string = "text-embedding-3-small",
    private readonly baseUrl: string = "https://api.openai.com/v1",
  ) {
    this.isConfigured = Boolean(apiKey);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) {
      throw new Error("OpenAiEmbeddingProvider used without OPENAI_API_KEY configured");
    }
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(
        `OpenAI embeddings request failed: ${response.status} ${await response.text()}`,
      );
    }
    const body = (await response.json()) as OpenAiEmbeddingResponse;
    return body.data.map((d) => d.embedding);
  }
}
