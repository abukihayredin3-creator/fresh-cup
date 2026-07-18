import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { PromotionsModule } from "../promotions/promotions.module";
import { CartController } from "./cart/cart.controller";
import { CartService } from "./cart/cart.service";
import { OrdersController } from "./orders/orders.controller";
import { OrdersService } from "./orders/orders.service";
import { TablesController } from "./tables/tables.controller";
import { TablesService } from "./tables/tables.service";

@Module({
  imports: [CatalogModule, PromotionsModule],
  controllers: [TablesController, CartController, OrdersController],
  providers: [TablesService, CartService, OrdersService],
  exports: [TablesService, CartService, OrdersService],
})
export class OrderingModule {}
