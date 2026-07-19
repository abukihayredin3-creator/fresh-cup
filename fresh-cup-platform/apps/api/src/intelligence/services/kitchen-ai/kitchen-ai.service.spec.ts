import type { PrismaService } from "../../../database/prisma.service";
import type { ExplanationService } from "../explanation.service";
import { KitchenAiService } from "./kitchen-ai.service";

function order(
  id: string,
  preparingAt: Date,
  readyAt: Date,
  items: { stationId: string | null; prepTimeSeconds: number; quantity: number }[],
) {
  return { id, preparingAt, readyAt, items };
}

describe("KitchenAiService", () => {
  function makeService(
    orders: ReturnType<typeof order>[],
    stations: { id: string; name: string }[] = [],
  ) {
    const prisma = {
      order: { findMany: jest.fn().mockResolvedValue(orders) },
      kitchenStation: { findMany: jest.fn().mockResolvedValue(stations) },
    } as unknown as jest.Mocked<PrismaService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;
    const service = new KitchenAiService(prisma, explanation);
    return { service, prisma };
  }

  it("flags a station as a bottleneck when actual prep time overruns its slowest item's estimate", async () => {
    const base = new Date("2026-07-01T12:00:00Z");
    const orders = [
      order("order-1", base, new Date(base.getTime() + 900 * 1000), [
        { stationId: "station-1", prepTimeSeconds: 300, quantity: 1 },
      ]),
      order("order-2", base, new Date(base.getTime() + 800 * 1000), [
        { stationId: "station-1", prepTimeSeconds: 300, quantity: 1 },
      ]),
      order("order-3", base, new Date(base.getTime() + 310 * 1000), [
        { stationId: "station-2", prepTimeSeconds: 300, quantity: 1 },
      ]),
    ];
    const { service } = makeService(orders, [
      { id: "station-1", name: "Blending" },
      { id: "station-2", name: "Grill" },
    ]);

    const results = await service.prepBottlenecks();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Prep bottleneck: Blending");
    expect((results[0]!.data as { bottleneckOrderCount: number }).bottleneckOrderCount).toBe(2);
  });

  it("sums item quantities per station for station workload", async () => {
    const base = new Date("2026-07-01T12:00:00Z");
    const orders = [
      order("order-1", base, new Date(base.getTime() + 100 * 1000), [
        { stationId: "station-1", prepTimeSeconds: 100, quantity: 2 },
      ]),
      order("order-2", base, new Date(base.getTime() + 100 * 1000), [
        { stationId: "station-1", prepTimeSeconds: 100, quantity: 3 },
      ]),
    ];
    const { service } = makeService(orders, [{ id: "station-1", name: "Blending" }]);

    const results = await service.stationWorkload();
    expect(results).toHaveLength(1);
    expect((results[0]!.data as { itemsPreparedLast30Days: number }).itemsPreparedLast30Days).toBe(
      5,
    );
  });

  it("flags orders more than 2 standard deviations above the mean prep time as anomalies", async () => {
    const base = new Date("2026-07-01T12:00:00Z");
    const normal = (id: string) =>
      order(id, base, new Date(base.getTime() + 300 * 1000), [
        { stationId: "s1", prepTimeSeconds: 300, quantity: 1 },
      ]);
    // 8 baseline orders at 300s (mean 400s, sd 300s once the outlier is included)
    // plus one outlier at 1200s — comfortably above mean + 2*sd (1000s).
    const orders = [
      ...Array.from({ length: 8 }, (_, i) => normal(`normal-${i}`)),
      order("outlier1", base, new Date(base.getTime() + 1200 * 1000), [
        { stationId: "s1", prepTimeSeconds: 300, quantity: 1 },
      ]),
    ];
    const { service } = makeService(orders);

    const results = await service.prepTimeAnomalies();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toContain("outlier1".slice(0, 8));
  });

  it("returns no anomalies when there isn't enough variance to establish a baseline", async () => {
    const base = new Date("2026-07-01T12:00:00Z");
    const orders = [
      order("o1", base, new Date(base.getTime() + 300 * 1000), [
        { stationId: "s1", prepTimeSeconds: 300, quantity: 1 },
      ]),
      order("o2", base, new Date(base.getTime() + 300 * 1000), [
        { stationId: "s1", prepTimeSeconds: 300, quantity: 1 },
      ]),
    ];
    const { service } = makeService(orders);
    const results = await service.prepTimeAnomalies();
    expect(results).toHaveLength(0);
  });

  it("only surfaces efficiency recommendations for stations with 3+ bottleneck orders", async () => {
    const base = new Date("2026-07-01T12:00:00Z");
    const overrun = (id: string) =>
      order(id, base, new Date(base.getTime() + 900 * 1000), [
        { stationId: "s1", prepTimeSeconds: 300, quantity: 1 },
      ]);
    const { service: twoOrders } = makeService(
      [overrun("o1"), overrun("o2")],
      [{ id: "s1", name: "Blending" }],
    );
    expect(await twoOrders.efficiencyRecommendations()).toHaveLength(0);

    const { service: threeOrders } = makeService(
      [overrun("o1"), overrun("o2"), overrun("o3")],
      [{ id: "s1", name: "Blending" }],
    );
    const results = await threeOrders.efficiencyRecommendations();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Efficiency recommendation: Blending");
  });
});
