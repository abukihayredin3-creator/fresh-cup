import { Module } from "@nestjs/common";
import { MenuCategoriesController } from "./categories/menu-categories.controller";
import { MenuCategoriesService } from "./categories/menu-categories.service";
import { MenuItemImagesService } from "./menu-items/menu-item-images.service";
import { MenuItemsController } from "./menu-items/menu-items.controller";
import { MenuItemsService } from "./menu-items/menu-items.service";

@Module({
  controllers: [MenuCategoriesController, MenuItemsController],
  providers: [MenuCategoriesService, MenuItemsService, MenuItemImagesService],
  exports: [MenuCategoriesService, MenuItemsService],
})
export class CatalogModule {}
