import type { CustomerVector } from "./clustering-strategy.interface";
import { KMeansClusteringStrategy } from "./kmeans-clustering.strategy";

function customer(overrides: Partial<CustomerVector>): CustomerVector {
  return {
    userId: "u1",
    fullName: "Test",
    recencyDays: 10,
    ordersCount: 1,
    totalSpendEtb: 100,
    ...overrides,
  };
}

describe("KMeansClusteringStrategy", () => {
  const strategy = new KMeansClusteringStrategy();

  it("returns an empty array for no customers", () => {
    expect(strategy.cluster([])).toEqual([]);
  });

  it("is deterministic — the same input always produces the same clusters", () => {
    const vectors = Array.from({ length: 15 }, (_, i) =>
      customer({
        userId: `u${i}`,
        recencyDays: i * 7,
        ordersCount: (i % 5) + 1,
        totalSpendEtb: i * 300,
      }),
    );
    const first = strategy.cluster(vectors);
    const second = strategy.cluster(vectors);
    expect(first).toEqual(second);
  });

  it("assigns every customer a valid segment label", () => {
    const vectors = Array.from({ length: 15 }, (_, i) =>
      customer({
        userId: `u${i}`,
        recencyDays: i * 7,
        ordersCount: (i % 5) + 1,
        totalSpendEtb: i * 300,
      }),
    );
    const result = strategy.cluster(vectors);
    const validLabels = ["VIP", "High Value", "Occasional", "New", "Dormant", "At Risk", "Lost"];
    expect(result.every((r) => validLabels.includes(r.segment))).toBe(true);
    expect(result).toHaveLength(15);
  });

  it("groups a clearly best customer and a clearly worst customer into different clusters", () => {
    const vectors = [
      customer({ userId: "best", recencyDays: 1, ordersCount: 50, totalSpendEtb: 100000 }),
      customer({ userId: "worst", recencyDays: 300, ordersCount: 1, totalSpendEtb: 50 }),
      ...Array.from({ length: 8 }, (_, i) =>
        customer({ userId: `mid-${i}`, recencyDays: 30 + i, ordersCount: 5, totalSpendEtb: 2000 }),
      ),
    ];
    const result = strategy.cluster(vectors);
    const best = result.find((r) => r.userId === "best")!;
    const worst = result.find((r) => r.userId === "worst")!;
    expect(best.segment).not.toBe(worst.segment);
  });

  it("handles fewer customers than k without throwing", () => {
    const vectors = [customer({ userId: "a" }), customer({ userId: "b", recencyDays: 100 })];
    const result = strategy.cluster(vectors);
    expect(result).toHaveLength(2);
  });
});
