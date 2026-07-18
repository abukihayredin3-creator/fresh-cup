import type { ConfigService } from "@nestjs/config";
import type { DeliveryZone } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { PrismaService } from "../../../database/prisma.service";
import { DeliveryZonesService } from "./delivery-zones.service";

function makeZone(overrides: Partial<DeliveryZone>): DeliveryZone {
  return {
    id: "zone-1",
    branchId: "branch-1",
    name: "Test Zone",
    centerLat: 9.0157 as unknown as DeliveryZone["centerLat"],
    centerLng: 38.7369 as unknown as DeliveryZone["centerLng"],
    radiusKm: 5 as unknown as DeliveryZone["radiusKm"],
    baseFee: 3000,
    perKmFee: 500,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DeliveryZone;
}

describe("DeliveryZonesService", () => {
  let service: DeliveryZonesService;
  let prisma: { deliveryZone: { findMany: jest.Mock } };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = { deliveryZone: { findMany: jest.fn() } };
    config = { get: jest.fn().mockReturnValue(5000) };
    service = new DeliveryZonesService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  describe("match", () => {
    it("matches a point inside a zone and computes distance-based fee", async () => {
      const zone = makeZone({ radiusKm: 5 as unknown as DeliveryZone["radiusKm"] });
      prisma.deliveryZone.findMany.mockResolvedValue([zone]);

      const result = await service.match("branch-1", 9.02, 38.74);

      expect(result.zone?.id).toBe("zone-1");
      expect(result.distanceKm).not.toBeNull();
      expect(result.fee).toBe(Math.round(3000 + 500 * (result.distanceKm ?? 0)));
    });

    it("picks the smallest-radius zone that covers the point when zones overlap", async () => {
      const wideZone = makeZone({
        id: "wide",
        radiusKm: 20 as unknown as DeliveryZone["radiusKm"],
      });
      const narrowZone = makeZone({
        id: "narrow",
        radiusKm: 5 as unknown as DeliveryZone["radiusKm"],
      });
      // Service relies on the query's orderBy — mock returns them pre-sorted ascending.
      prisma.deliveryZone.findMany.mockResolvedValue([narrowZone, wideZone]);

      const result = await service.match("branch-1", 9.02, 38.74);

      expect(result.zone?.id).toBe("narrow");
    });

    it("falls back to the flat fee when no zone covers the point", async () => {
      const farZone = makeZone({ radiusKm: 1 as unknown as DeliveryZone["radiusKm"] });
      prisma.deliveryZone.findMany.mockResolvedValue([farZone]);

      // Far outside the 1km radius.
      const result = await service.match("branch-1", 9.5, 39.5);

      expect(result.zone).toBeNull();
      expect(result.distanceKm).toBeNull();
      expect(result.fee).toBe(5000);
      expect(config.get).toHaveBeenCalledWith("DELIVERY_FLAT_FEE", { infer: true });
    });

    it("falls back to the flat fee when the branch has no zones configured", async () => {
      prisma.deliveryZone.findMany.mockResolvedValue([]);

      const result = await service.match("branch-1", 9.02, 38.74);

      expect(result.zone).toBeNull();
      expect(result.fee).toBe(5000);
    });
  });

  describe("quote", () => {
    it("reports inZone true and a distance-based eta when a zone matches", async () => {
      prisma.deliveryZone.findMany.mockResolvedValue([makeZone({})]);

      const quote = await service.quote("branch-1", 9.02, 38.74);

      expect(quote.inZone).toBe(true);
      expect(quote.zoneId).toBe("zone-1");
      expect(quote.etaMinutes).toBeGreaterThanOrEqual(10);
    });

    it("reports inZone false with a default eta on fallback", async () => {
      prisma.deliveryZone.findMany.mockResolvedValue([]);

      const quote = await service.quote("branch-1", 9.02, 38.74);

      expect(quote.inZone).toBe(false);
      expect(quote.zoneId).toBeNull();
      expect(quote.etaMinutes).toBe(20);
    });
  });
});
