import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type ModifierGroup, type ModifierOption } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateModifierGroupDto } from "./dto/create-modifier-group.dto";
import type { CreateModifierOptionDto } from "./dto/create-modifier-option.dto";
import type { ListModifierGroupsQueryDto } from "./dto/list-modifier-groups-query.dto";
import type { ModifierGroupResponseDto } from "./dto/modifier-group-response.dto";
import type { UpdateModifierGroupDto } from "./dto/update-modifier-group.dto";
import type { UpdateModifierOptionDto } from "./dto/update-modifier-option.dto";

type ModifierGroupWithOptions = ModifierGroup & { options: ModifierOption[] };

const WITH_OPTIONS = { options: { orderBy: { sortOrder: Prisma.SortOrder.asc } } } as const;

@Injectable()
export class ModifierGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListModifierGroupsQueryDto) {
    return paginate<ModifierGroupWithOptions>(
      (page) =>
        this.prisma.modifierGroup.findMany({
          where: query.branchId ? { branchId: query.branchId } : {},
          orderBy: { createdAt: "asc" },
          include: WITH_OPTIONS,
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<ModifierGroupWithOptions> {
    const group = await this.prisma.modifierGroup.findUnique({
      where: { id },
      include: WITH_OPTIONS,
    });
    if (!group) {
      throw new NotFoundException("Modifier group not found");
    }
    return group;
  }

  create(actor: RequestUser, dto: CreateModifierGroupDto): Promise<ModifierGroupWithOptions> {
    assertBranchAccess(actor, dto.branchId);
    this.assertSelectionBounds(dto.selectionType, dto.minSelect, dto.maxSelect);
    return this.prisma.modifierGroup.create({ data: dto, include: WITH_OPTIONS });
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateModifierGroupDto,
  ): Promise<ModifierGroupWithOptions> {
    const group = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, group.branchId);
    this.assertSelectionBounds(
      dto.selectionType ?? group.selectionType,
      dto.minSelect ?? group.minSelect,
      dto.maxSelect === undefined ? group.maxSelect : dto.maxSelect,
    );
    return this.prisma.modifierGroup.update({ where: { id }, data: dto, include: WITH_OPTIONS });
  }

  /** Soft delete — attached menu items keep the historical link, it just stops appearing. */
  async softDelete(actor: RequestUser, id: string): Promise<void> {
    const group = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, group.branchId);
    await this.prisma.modifierGroup.update({ where: { id }, data: { isActive: false } });
  }

  async addOption(
    actor: RequestUser,
    groupId: string,
    dto: CreateModifierOptionDto,
  ): Promise<ModifierOption> {
    const group = await this.findByIdOrThrow(groupId);
    assertBranchAccess(actor, group.branchId);
    return this.prisma.modifierOption.create({ data: { ...dto, modifierGroupId: groupId } });
  }

  async updateOption(
    actor: RequestUser,
    groupId: string,
    optionId: string,
    dto: UpdateModifierOptionDto,
  ): Promise<ModifierOption> {
    const group = await this.findByIdOrThrow(groupId);
    assertBranchAccess(actor, group.branchId);
    await this.findOptionOrThrow(groupId, optionId);
    return this.prisma.modifierOption.update({ where: { id: optionId }, data: dto });
  }

  async removeOption(actor: RequestUser, groupId: string, optionId: string): Promise<void> {
    const group = await this.findByIdOrThrow(groupId);
    assertBranchAccess(actor, group.branchId);
    await this.findOptionOrThrow(groupId, optionId);
    await this.prisma.modifierOption.update({
      where: { id: optionId },
      data: { isActive: false },
    });
  }

  private async findOptionOrThrow(groupId: string, optionId: string): Promise<ModifierOption> {
    const option = await this.prisma.modifierOption.findUnique({ where: { id: optionId } });
    if (!option || option.modifierGroupId !== groupId) {
      throw new NotFoundException("Modifier option not found for this group");
    }
    return option;
  }

  private assertSelectionBounds(
    selectionType: CreateModifierGroupDto["selectionType"],
    minSelect: number | undefined,
    maxSelect: number | null | undefined,
  ): void {
    if (
      selectionType === "SINGLE" &&
      maxSelect !== undefined &&
      maxSelect !== null &&
      maxSelect > 1
    ) {
      throw new BadRequestException("A SINGLE-selection modifier group cannot have maxSelect > 1");
    }
    if (
      maxSelect !== undefined &&
      maxSelect !== null &&
      minSelect !== undefined &&
      maxSelect < minSelect
    ) {
      throw new BadRequestException("maxSelect cannot be less than minSelect");
    }
  }

  toResponse(group: ModifierGroupWithOptions): ModifierGroupResponseDto {
    return {
      id: group.id,
      branchId: group.branchId,
      nameEn: group.nameEn,
      nameAm: group.nameAm,
      selectionType: group.selectionType,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      isActive: group.isActive,
      options: group.options.map((option) => this.optionToResponse(option)),
    };
  }

  optionToResponse(option: ModifierOption): ModifierGroupResponseDto["options"][number] {
    return {
      id: option.id,
      nameEn: option.nameEn,
      nameAm: option.nameAm,
      priceDelta: option.priceDelta,
      isActive: option.isActive,
      sortOrder: option.sortOrder,
    };
  }
}
