import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type RecipeIngredient } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateRecipeIngredientDto } from "./dto/create-recipe-ingredient.dto";
import type { ListRecipeIngredientsQueryDto } from "./dto/list-recipe-ingredients-query.dto";
import type { RecipeIngredientResponseDto } from "./dto/recipe-ingredient-response.dto";
import type { UpdateRecipeIngredientDto } from "./dto/update-recipe-ingredient.dto";

@Injectable()
export class RecipeIngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListRecipeIngredientsQueryDto) {
    const where: Prisma.RecipeIngredientWhereInput = {};
    if (query.menuItemId) {
      where.menuItemId = query.menuItemId;
    }
    if (query.inventoryItemId) {
      where.inventoryItemId = query.inventoryItemId;
    }

    return paginate<RecipeIngredient>(
      (page) =>
        this.prisma.recipeIngredient.findMany({
          where,
          orderBy: { createdAt: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<RecipeIngredient> {
    const ingredient = await this.prisma.recipeIngredient.findUnique({ where: { id } });
    if (!ingredient) {
      throw new NotFoundException("Recipe ingredient not found");
    }
    return ingredient;
  }

  async create(actor: RequestUser, dto: CreateRecipeIngredientDto): Promise<RecipeIngredient> {
    const [menuItem, inventoryItem] = await Promise.all([
      this.prisma.menuItem.findUnique({ where: { id: dto.menuItemId } }),
      this.prisma.inventoryItem.findUnique({ where: { id: dto.inventoryItemId } }),
    ]);
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }
    if (!inventoryItem) {
      throw new NotFoundException("Inventory item not found");
    }
    if (menuItem.branchId !== inventoryItem.branchId) {
      throw new ConflictException("Menu item and inventory item must belong to the same branch");
    }
    assertBranchAccess(actor, menuItem.branchId);

    try {
      return await this.prisma.recipeIngredient.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          "This menu item already has a recipe entry for that ingredient",
        );
      }
      throw error;
    }
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateRecipeIngredientDto,
  ): Promise<RecipeIngredient> {
    const ingredient = await this.findByIdOrThrow(id);
    const menuItem = await this.prisma.menuItem.findUniqueOrThrow({
      where: { id: ingredient.menuItemId },
    });
    assertBranchAccess(actor, menuItem.branchId);
    return this.prisma.recipeIngredient.update({ where: { id }, data: dto });
  }

  async remove(actor: RequestUser, id: string): Promise<void> {
    const ingredient = await this.findByIdOrThrow(id);
    const menuItem = await this.prisma.menuItem.findUniqueOrThrow({
      where: { id: ingredient.menuItemId },
    });
    assertBranchAccess(actor, menuItem.branchId);
    await this.prisma.recipeIngredient.delete({ where: { id } });
  }

  toResponse(ingredient: RecipeIngredient): RecipeIngredientResponseDto {
    return {
      id: ingredient.id,
      menuItemId: ingredient.menuItemId,
      inventoryItemId: ingredient.inventoryItemId,
      quantityPerUnit: Number(ingredient.quantityPerUnit),
      createdAt: ingredient.createdAt,
      updatedAt: ingredient.updatedAt,
    };
  }
}
