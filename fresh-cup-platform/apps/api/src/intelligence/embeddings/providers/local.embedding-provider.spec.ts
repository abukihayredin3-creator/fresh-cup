import { LocalEmbeddingProvider } from "./local.embedding-provider";

describe("LocalEmbeddingProvider", () => {
  const provider = new LocalEmbeddingProvider();

  it("is always configured (no external dependency)", () => {
    expect(provider.isConfigured).toBe(true);
  });

  it("returns a unit vector of the declared dimensionality per input", async () => {
    const [vector] = await provider.embed(["revenue is up this week"]);
    expect(vector).toHaveLength(provider.dimensions);
    const magnitude = Math.sqrt(vector!.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("is deterministic — same text always produces the same vector", async () => {
    const [a] = await provider.embed(["churn risk customers"]);
    const [b] = await provider.embed(["churn risk customers"]);
    expect(a).toEqual(b);
  });

  it("produces different vectors for different text (near-duplicate recall signal)", async () => {
    const [a] = await provider.embed(["sales are trending up"]);
    const [b] = await provider.embed(["inventory is running low"]);
    expect(a).not.toEqual(b);
  });

  it("handles empty input without dividing by zero", async () => {
    const [vector] = await provider.embed([""]);
    expect(vector).toEqual(new Array(provider.dimensions).fill(0));
  });
});
