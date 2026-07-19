export interface EmbeddingProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
