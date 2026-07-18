import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { RecipeIngredientsController } from "./recipes/recipe-ingredients.controller";
import { RecipeIngredientsService } from "./recipes/recipe-ingredients.service";

@Module({
  controllers: [InventoryController, RecipeIngredientsController],
  providers: [InventoryService, RecipeIngredientsService],
  exports: [InventoryService],
})
export class InventoryModule {}
