import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreateRecipeIngredientDto } from "./dto/create-recipe-ingredient.dto";
import { ListRecipeIngredientsQueryDto } from "./dto/list-recipe-ingredients-query.dto";
import { RecipeIngredientResponseDto } from "./dto/recipe-ingredient-response.dto";
import { UpdateRecipeIngredientDto } from "./dto/update-recipe-ingredient.dto";
import { RecipeIngredientsService } from "./recipe-ingredients.service";

@ApiTags("inventory")
@Controller("admin/recipe-ingredients")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("RecipeIngredient")
export class RecipeIngredientsController {
  constructor(private readonly recipesService: RecipeIngredientsService) {}

  @Get()
  @ApiOperation({
    summary: "List recipe ingredients, optionally filtered by menu/inventory item (staff+)",
  })
  async list(@Query() query: ListRecipeIngredientsQueryDto) {
    const page = await this.recipesService.list(query);
    return { ...page, items: page.items.map((r) => this.recipesService.toResponse(r)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a recipe ingredient by id (staff+)" })
  @ApiOkResponse({ type: RecipeIngredientResponseDto })
  async get(@Param("id") id: string): Promise<RecipeIngredientResponseDto> {
    const ingredient = await this.recipesService.findByIdOrThrow(id);
    return this.recipesService.toResponse(ingredient);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Map a menu item to an ingredient it consumes (manager/admin)" })
  @ApiOkResponse({ type: RecipeIngredientResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateRecipeIngredientDto,
  ): Promise<RecipeIngredientResponseDto> {
    const created = await this.recipesService.create(actor, dto);
    return this.recipesService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update the quantity consumed per unit (manager/admin)" })
  @ApiOkResponse({ type: RecipeIngredientResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateRecipeIngredientDto,
  ): Promise<RecipeIngredientResponseDto> {
    const updated = await this.recipesService.update(actor, id, dto);
    return this.recipesService.toResponse(updated);
  }

  @Delete(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a recipe mapping (manager/admin)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.recipesService.remove(actor, id);
  }
}
