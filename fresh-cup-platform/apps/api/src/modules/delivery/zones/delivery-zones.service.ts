import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DeliveryZone } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import { haversineKm } from "../../../common/geo/haversine";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateDeliveryZoneDto } from "./dto/create-delivery-zone.dto";
import type { DeliveryQuoteResponseDto } from "./dto/delivery-quote-response.dto";
import type { DeliveryZoneResponseDto } from "./dto/delivery-zone-response.dto";
import type { ListDeliveryZonesQueryDto } from "./dto/list-delivery-zones-query.dto";
import type { UpdateDeliveryZoneDto } from "./dto/update-delivery-zone.dto";

export interface ZoneMatch {
  zone: DeliveryZone | null;
  distanceKm: number | null;
  fee: number;
}

@Injectable()
export class DeliveryZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  list(query: ListDeliveryZonesQueryDto) {
    return paginate<DeliveryZone>(
      (page) =>
        this.prisma.deliveryZone.findMany({
          where: query.branchId ? { branchId: query.branchId } : {},
          orderBy: { radiusKm: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<DeliveryZone> {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) {
      throw new NotFoundException("Delivery zone not found");
    }
    return zone;
  }

  create(actor: RequestUser, dto: CreateDeliveryZoneDto): Promise<DeliveryZone> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.deliveryZone.create({ data: dto });
  }

  async update(actor: RequestUser, id: string, dto: UpdateDeliveryZoneDto): Promise<DeliveryZone> {
    const zone = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, zone.branchId);
    return this.prisma.deliveryZone.update({ where: { id }, data: dto });
  }

  async softDelete(actor: RequestUser, id: string): Promise<void> {
    const zone = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, zone.branchId);
    await this.prisma.deliveryZone.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Matches the most specific (smallest-radius) active zone whose circular
   * catchment covers the point; falls back to the flat MVP rate from Phase 2
   * when no zone is configured or none covers the point, so checkout keeps
   * working exactly as before zones existed.
   */
  async match(branchId: string, lat: number, lng: number): Promise<ZoneMatch> {
    const zones = await this.prisma.deliveryZone.findMany({
      where: { branchId, isActive: true },
      orderBy: { radiusKm: "asc" },
    });

    for (const zone of zones) {
      const distanceKm = haversineKm(Number(zone.centerLat), Number(zone.centerLng), lat, lng);
      if (distanceKm <= Number(zone.radiusKm)) {
        const fee = Math.round(zone.baseFee + zone.perKmFee * distanceKm);
        return { zone, distanceKm, fee };
      }
    }

    return {
      zone: null,
      distanceKm: null,
      fee: this.config.get("DELIVERY_FLAT_FEE", { infer: true }),
    };
  }

  async quote(branchId: string, lat: number, lng: number): Promise<DeliveryQuoteResponseDto> {
    const match = await this.match(branchId, lat, lng);
    const etaMinutes = match.distanceKm ? Math.round(10 + match.distanceKm * 3) : 20;
    return {
      fee: match.fee,
      etaMinutes,
      inZone: match.zone !== null,
      zoneId: match.zone?.id ?? null,
      distanceKm: match.distanceKm,
    };
  }

  toResponse(zone: DeliveryZone): DeliveryZoneResponseDto {
    return {
      id: zone.id,
      branchId: zone.branchId,
      name: zone.name,
      centerLat: Number(zone.centerLat),
      centerLng: Number(zone.centerLng),
      radiusKm: Number(zone.radiusKm),
      baseFee: zone.baseFee,
      perKmFee: zone.perKmFee,
      isActive: zone.isActive,
    };
  }
}
