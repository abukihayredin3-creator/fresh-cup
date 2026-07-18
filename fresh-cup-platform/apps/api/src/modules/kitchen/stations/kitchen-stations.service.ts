import { Injectable, NotFoundException } from "@nestjs/common";
import type { KitchenStation } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateKitchenStationDto } from "./dto/create-kitchen-station.dto";
import type { KitchenStationResponseDto } from "./dto/kitchen-station-response.dto";
import type { ListKitchenStationsQueryDto } from "./dto/list-kitchen-stations-query.dto";
import type { UpdateKitchenStationDto } from "./dto/update-kitchen-station.dto";

@Injectable()
export class KitchenStationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListKitchenStationsQueryDto) {
    return paginate<KitchenStation>(
      (page) =>
        this.prisma.kitchenStation.findMany({
          where: query.branchId ? { branchId: query.branchId } : {},
          orderBy: { name: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<KitchenStation> {
    const station = await this.prisma.kitchenStation.findUnique({ where: { id } });
    if (!station) {
      throw new NotFoundException("Kitchen station not found");
    }
    return station;
  }

  create(actor: RequestUser, dto: CreateKitchenStationDto): Promise<KitchenStation> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.kitchenStation.create({ data: dto });
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateKitchenStationDto,
  ): Promise<KitchenStation> {
    const station = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, station.branchId);
    return this.prisma.kitchenStation.update({ where: { id }, data: dto });
  }

  /** Soft delete — menu items referencing this station keep their (now-inactive) assignment. */
  async softDelete(actor: RequestUser, id: string): Promise<void> {
    const station = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, station.branchId);
    await this.prisma.kitchenStation.update({ where: { id }, data: { isActive: false } });
  }

  toResponse(station: KitchenStation): KitchenStationResponseDto {
    return {
      id: station.id,
      branchId: station.branchId,
      name: station.name,
      isActive: station.isActive,
    };
  }
}
