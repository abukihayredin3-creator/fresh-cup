import type { PrismaService } from "../../../database/prisma.service";
import type { ExplanationService } from "../explanation.service";
import { DeliveryAiService } from "./delivery-ai.service";

function delivery(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "delivery-1",
    driverId: "driver-1",
    zoneId: "zone-1",
    distanceKm: 5,
    fee: 5000,
    pickedUpAt: new Date("2026-07-01T12:00:00Z"),
    deliveredAt: new Date("2026-07-01T12:15:00Z"), // 5km in 15min = 20km/h
    ...overrides,
  };
}

describe("DeliveryAiService", () => {
  function makeService(
    deliveries: ReturnType<typeof delivery>[] = [],
    inFlight: unknown[] = [],
    zones: { id: string; name: string }[] = [],
    drivers: { id: string; fullName: string }[] = [],
  ) {
    const prisma = {
      delivery: {
        findMany: jest
          .fn()
          .mockImplementation(({ where }: { where: { status: unknown } }) =>
            Promise.resolve(
              typeof where.status === "object" &&
                where.status !== null &&
                "in" in (where.status as object)
                ? inFlight
                : deliveries,
            ),
          ),
      },
      deliveryZone: { findMany: jest.fn().mockResolvedValue(zones) },
      user: { findMany: jest.fn().mockResolvedValue(drivers) },
    } as unknown as jest.Mocked<PrismaService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;
    const service = new DeliveryAiService(prisma, explanation);
    return { service, prisma };
  }

  it("predicts ETA using the fleet's average speed from delivery history", async () => {
    const { service } = makeService([delivery(), delivery({ id: "d2" })]);
    const result = await service.etaPrediction(10);
    const data = result.data as { predictedMinutes: number; avgSpeedKmH: number };
    expect(data.avgSpeedKmH).toBeCloseTo(20, 5);
    expect(data.predictedMinutes).toBe(30); // 10km at 20km/h = 30 min
  });

  it("falls back to a default speed with no delivery history", async () => {
    const { service } = makeService([]);
    const result = await service.etaPrediction(10);
    const data = result.data as { avgSpeedKmH: number };
    expect(data.avgSpeedKmH).toBe(20);
  });

  it("flags in-flight deliveries running well past their expected duration", async () => {
    const history = [delivery(), delivery({ id: "d2" })]; // 20km/h fleet average
    const inFlight = [
      {
        id: "late-1",
        distanceKm: 5,
        // expected ~15min at 20km/h; elapsed 40min far exceeds 1.3x
        pickedUpAt: new Date(Date.now() - 40 * 60 * 1000),
      },
      {
        id: "ontime-1",
        distanceKm: 5,
        pickedUpAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    ];
    const { service } = makeService(history, inFlight);

    const results = await service.delayDetection();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toContain("late-1".slice(0, 8));
  });

  it("groups completed deliveries by zone and computes fee-per-km", async () => {
    const { service } = makeService(
      [
        delivery({ zoneId: "zone-1", fee: 5000, distanceKm: 5 }),
        delivery({ id: "d2", zoneId: "zone-1", fee: 6000, distanceKm: 5 }),
      ],
      [],
      [{ id: "zone-1", name: "Merkato Core" }],
    );

    const results = await service.zoneOptimization();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Zone: Merkato Core");
    const data = results[0]!.data as { deliveryCount: number; avgFeeEtb: number };
    expect(data.deliveryCount).toBe(2);
    expect(data.avgFeeEtb).toBeCloseTo(55, 5);
  });

  it("groups completed deliveries by driver and computes avg duration", async () => {
    const { service } = makeService(
      [delivery({ driverId: "driver-1" }), delivery({ id: "d2", driverId: "driver-1" })],
      [],
      [],
      [{ id: "driver-1", fullName: "Yonas" }],
    );

    const results = await service.driverUtilization();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Driver utilization: Yonas");
    const data = results[0]!.data as { deliveriesCompleted: number; avgDurationMinutes: number };
    expect(data.deliveriesCompleted).toBe(2);
    expect(data.avgDurationMinutes).toBe(15);
  });
});
