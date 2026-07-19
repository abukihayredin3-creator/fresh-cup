import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Region } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CreateRegionDto } from "./dto/create-region.dto";
import type { UpdateRegionDto } from "./dto/update-region.dto";

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<Region[]> {
    return this.prisma.region.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  }

  async findByIdOrThrow(organizationId: string, id: string): Promise<Region> {
    const region = await this.prisma.region.findUnique({ where: { id } });
    if (!region || region.organizationId !== organizationId) {
      throw new NotFoundException("Region not found");
    }
    return region;
  }

  create(organizationId: string, dto: CreateRegionDto): Promise<Region> {
    return this.prisma.region.create({ data: { organizationId, ...dto } });
  }

  async update(organizationId: string, id: string, dto: UpdateRegionDto): Promise<Region> {
    await this.findByIdOrThrow(organizationId, id);
    return this.prisma.region.update({ where: { id }, data: dto });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, id);
    await this.prisma.region.delete({ where: { id } });
  }

  /** Assigns a branch to this region — both must belong to the same organization. */
  async assignBranch(organizationId: string, id: string, branchId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, id);
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organizationId !== organizationId) {
      throw new ForbiddenException("That branch does not belong to your organization");
    }
    await this.prisma.branch.update({ where: { id: branchId }, data: { regionId: id } });
  }
}
