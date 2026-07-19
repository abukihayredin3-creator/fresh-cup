import type { CustomerVector } from "./clustering-strategy.interface";
import { RuleBasedClusteringStrategy } from "./rule-based-clustering.strategy";

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

describe("RuleBasedClusteringStrategy", () => {
  const strategy = new RuleBasedClusteringStrategy();

  it("returns an empty array for no customers", () => {
    expect(strategy.cluster([])).toEqual([]);
  });

  it("labels a long-inactive customer as Lost", () => {
    const vectors = [
      customer({ userId: "a", recencyDays: 200 }),
      customer({ userId: "b", recencyDays: 5 }),
    ];
    const result = strategy.cluster(vectors);
    expect(result.find((r) => r.userId === "a")!.segment).toBe("Lost");
  });

  it("labels a moderately-inactive customer as Dormant", () => {
    const vectors = [
      customer({ userId: "a", recencyDays: 90 }),
      customer({ userId: "b", recencyDays: 5 }),
    ];
    const result = strategy.cluster(vectors);
    expect(result.find((r) => r.userId === "a")!.segment).toBe("Dormant");
  });

  it("labels a first-time recent customer as New", () => {
    const vectors = [
      customer({ userId: "a", recencyDays: 5, ordersCount: 1, totalSpendEtb: 50 }),
      ...Array.from({ length: 5 }, (_, i) =>
        customer({ userId: `filler-${i}`, recencyDays: 5, ordersCount: 5, totalSpendEtb: 5000 }),
      ),
    ];
    const result = strategy.cluster(vectors);
    expect(result.find((r) => r.userId === "a")!.segment).toBe("New");
  });

  it("assigns every customer some label from the fixed taxonomy", () => {
    const vectors = Array.from({ length: 20 }, (_, i) =>
      customer({
        userId: `u${i}`,
        recencyDays: i * 5,
        ordersCount: (i % 6) + 1,
        totalSpendEtb: i * 500,
      }),
    );
    const result = strategy.cluster(vectors);
    const validLabels = ["VIP", "High Value", "Occasional", "New", "Dormant", "At Risk", "Lost"];
    expect(result.every((r) => validLabels.includes(r.segment))).toBe(true);
    expect(result).toHaveLength(20);
  });
});
