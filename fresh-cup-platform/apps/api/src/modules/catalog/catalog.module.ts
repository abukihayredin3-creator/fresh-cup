import { Module } from "@nestjs/common";
import { MenuCategoriesController } from "./categories/menu-categories.controller";
import { MenuCategoriesService } from "./categories/menu-categories.service";
import { MenuItemImagesService } from "./menu-items/menu-item-images.service";
import { MenuItemsController } from "./menu-items/menu-items.controller";
import { MenuItemsService } from "./menu-items/menu-items.service";
import { MenuItemModifierGroupsService } from "./modifiers/menu-item-modifier-groups.service";
import { ModifierGroupsController } from "./modifiers/modifier-groups.controller";
import { ModifierGroupsService } from "./modifiers/modifier-groups.service";

@Module({
  controllers: [MenuCategoriesController, MenuItemsController, ModifierGroupsController],
  providers: [
    MenuCategoriesService,
    MenuItemsService,
    MenuItemImagesService,
    ModifierGroupsService,
    MenuItemModifierGroupsService,
  ],
  exports: [MenuCategoriesService, MenuItemsService, ModifierGroupsService],
})
export class CatalogModule {}
