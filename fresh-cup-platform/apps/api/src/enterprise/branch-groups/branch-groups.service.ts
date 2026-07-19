import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { BranchGroup } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CreateBranchGroupDto } from "./dto/create-branch-group.dto";

@Injectable()
export class BranchGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<BranchGroup[]> {
    return this.prisma.branchGroup.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async findByIdOrThrow(organizationId: string, id: string): Promise<BranchGroup> {
    const group = await this.prisma.branchGroup.findUnique({ where: { id } });
    if (!group || group.organizationId !== organizationId) {
      throw new NotFoundException("Branch group not found");
    }
    return group;
  }

  create(organizationId: string, dto: CreateBranchGroupDto): Promise<BranchGroup> {
    return this.prisma.branchGroup.create({ data: { organizationId, ...dto } });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, id);
    await this.prisma.branchGroup.delete({ where: { id } });
  }

  async addBranch(organizationId: string, id: string, branchId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, id);
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organizationId !== organizationId) {
      throw new ForbiddenException("That branch does not belong to your organization");
    }
    await this.prisma.branchGroupMembership.upsert({
      where: { branchGroupId_branchId: { branchGroupId: id, branchId } },
      create: { branchGroupId: id, branchId },
      update: {},
    });
  }

  async removeBranch(organizationId: string, id: string, branchId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, id);
    await this.prisma.branchGroupMembership.deleteMany({
      where: { branchGroupId: id, branchId },
    });
  }

  async listBranches(organizationId: string, id: string): Promise<string[]> {
    await this.findByIdOrThrow(organizationId, id);
    const memberships = await this.prisma.branchGroupMembership.findMany({
      where: { branchGroupId: id },
      select: { branchId: true },
    });
    return memberships.map((m) => m.branchId);
  }
}
