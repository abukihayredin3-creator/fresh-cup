import { Injectable, NotFoundException } from "@nestjs/common";
import type { Branch } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { BranchResponseDto } from "./dto/branch-response.dto";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(): Promise<Branch[]> {
    return this.prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  async findByIdOrThrow(id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  create(dto: CreateBranchDto): Promise<Branch> {
    return this.prisma.branch.create({ data: dto });
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.findByIdOrThrow(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  toResponse(branch: Branch): BranchResponseDto {
    return {
      id: branch.id,
      name: branch.name,
      addressText: branch.addressText,
      lat: branch.lat ? Number(branch.lat) : null,
      lng: branch.lng ? Number(branch.lng) : null,
      phone: branch.phone,
      isActive: branch.isActive,
    };
  }
}
