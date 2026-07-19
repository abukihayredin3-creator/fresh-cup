import { PgVectorProvider } from "./pgvector.vector-provider";

describe("PgVectorProvider", () => {
  function fakePrisma(
    rows: { id: string; embedding: number[]; content?: string; metadata?: unknown }[],
  ) {
    return {
      vectorEntry: {
        upsert: jest.fn(),
        findMany: jest
          .fn()
          .mockResolvedValue(
            rows.map((r) => ({
              ...r,
              namespace: "ai-memory",
              content: r.content ?? null,
              metadata: r.metadata ?? null,
            })),
          ),
        deleteMany: jest.fn(),
      },
    } as never;
  }

  it("is always configured (no external service required)", () => {
    const provider = new PgVectorProvider(fakePrisma([]));
    expect(provider.isConfigured).toBe(true);
  });

  it("upserts each record via prisma.vectorEntry.upsert", async () => {
    const prisma = fakePrisma([]);
    const provider = new PgVectorProvider(prisma);
    await provider.upsert("ai-memory", [{ id: "v1", embedding: [1, 0, 0], content: "hello" }]);
    expect(
      (prisma as never as { vectorEntry: { upsert: jest.Mock } }).vectorEntry.upsert,
    ).toHaveBeenCalledTimes(1);
  });

  it("ranks query results by cosine similarity, best first", async () => {
    const prisma = fakePrisma([
      { id: "close", embedding: [1, 0, 0] },
      { id: "far", embedding: [0, 1, 0] },
      { id: "opposite", embedding: [-1, 0, 0] },
    ]);
    const provider = new PgVectorProvider(prisma);
    const results = await provider.query("ai-memory", [1, 0, 0], 3);

    expect(results.map((r) => r.id)).toEqual(["close", "far", "opposite"]);
    expect(results[0]!.score).toBeCloseTo(1, 5);
  });

  it("respects topK", async () => {
    const prisma = fakePrisma([
      { id: "a", embedding: [1, 0] },
      { id: "b", embedding: [0.9, 0.1] },
      { id: "c", embedding: [0, 1] },
    ]);
    const provider = new PgVectorProvider(prisma);
    const results = await provider.query("ai-memory", [1, 0], 2);
    expect(results).toHaveLength(2);
  });

  it("deletes by namespace + id", async () => {
    const prisma = fakePrisma([]);
    const provider = new PgVectorProvider(prisma);
    await provider.delete("ai-memory", ["v1", "v2"]);
    expect(
      (prisma as never as { vectorEntry: { deleteMany: jest.Mock } }).vectorEntry.deleteMany,
    ).toHaveBeenCalledWith({
      where: { namespace: "ai-memory", id: { in: ["v1", "v2"] } },
    });
  });
});
