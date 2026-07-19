import { Injectable, NotFoundException } from "@nestjs/common";
import type { Branch, BranchHours } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { BranchHoursResponseDto, SetBranchHoursDto } from "./dto/branch-hours.dto";
import type { BranchResponseDto } from "./dto/branch-response.dto";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(): Promise<Branch[]> {
    return this.prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  /** Admins/managers need every branch, including inactive ones, to reactivate or audit them. */
  listAll(): Promise<Branch[]> {
    return this.prisma.branch.findMany({ orderBy: { name: "asc" } });
  }

  async findByIdOrThrow(id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  /**
   * `organizationId` isn't part of CreateBranchDto — Phase 8 Part 1 made
   * every Branch belong to an Organization, and a brand-new branch always
   * joins the creating admin's own organization (resolved by the caller
   * via TenantContextService), never an arbitrary one passed in the body.
   */
  create(dto: CreateBranchDto, organizationId: string): Promise<Branch> {
    return this.prisma.branch.create({ data: { ...dto, organizationId } });
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.findByIdOrThrow(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async getHours(branchId: string): Promise<BranchHours[]> {
    await this.findByIdOrThrow(branchId);
    return this.prisma.branchHours.findMany({
      where: { branchId },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  /** Replaces the full week in one call — the admin UI always edits all 7 days together. */
  async setHours(branchId: string, dto: SetBranchHoursDto): Promise<BranchHours[]> {
    await this.findByIdOrThrow(branchId);
    await this.prisma.$transaction(
      dto.days.map((day) =>
        this.prisma.branchHours.upsert({
          where: { branchId_dayOfWeek: { branchId, dayOfWeek: day.dayOfWeek } },
          create: { branchId, ...day },
          update: day,
        }),
      ),
    );
    return this.getHours(branchId);
  }

  toResponse(branch: Branch): BranchResponseDto {
    return {
      id: branch.id,
      name: branch.name,
      addressText: branch.addressText,
      lat: branch.lat ? Number(branch.lat) : null,
      lng: branch.lng ? Number(branch.lng) : null,
      phone: branch.phone,
      managerId: branch.managerId,
      isActive: branch.isActive,
    };
  }

  hoursToResponse(hours: BranchHours): BranchHoursResponseDto {
    return {
      id: hours.id,
      dayOfWeek: hours.dayOfWeek,
      opensAt: hours.opensAt ?? undefined,
      closesAt: hours.closesAt ?? undefined,
      isClosed: hours.isClosed,
    };
  }
}
