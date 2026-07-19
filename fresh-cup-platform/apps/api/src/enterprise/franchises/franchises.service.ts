import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Franchise } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CreateFranchiseDto } from "./dto/create-franchise.dto";
import type { UpdateFranchiseDto } from "./dto/update-franchise.dto";

@Injectable()
export class FranchisesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<Franchise[]> {
    return this.prisma.franchise.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async findByIdOrThrow(organizationId: string, id: string): Promise<Franchise> {
    const franchise = await this.prisma.franchise.findUnique({ where: { id } });
    if (!franchise || franchise.organizationId !== organizationId) {
      throw new NotFoundException("Franchise not found");
    }
    return franchise;
  }

  create(organizationId: string, dto: CreateFranchiseDto): Promise<Franchise> {
    return this.prisma.franchise.create({ data: { organizationId, ...dto } });
  }

  async update(organizationId: string, id: string, dto: UpdateFranchiseDto): Promise<Franchise> {
    await this.findByIdOrThrow(organizationId, id);
    return this.prisma.franchise.update({ where: { id }, data: dto });
  }

  async assignBranch(organizationId: string, id: string, branchId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, id);
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organizationId !== organizationId) {
      throw new ForbiddenException("That branch does not belong to your organization");
    }
    await this.prisma.branch.update({ where: { id: branchId }, data: { franchiseId: id } });
  }
}
