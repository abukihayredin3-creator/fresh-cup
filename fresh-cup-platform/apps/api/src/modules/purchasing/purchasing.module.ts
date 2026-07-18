import { Module } from "@nestjs/common";
import { PurchaseOrdersController } from "./purchase-orders/purchase-orders.controller";
import { PurchaseOrdersService } from "./purchase-orders/purchase-orders.service";
import { SuppliersController } from "./suppliers/suppliers.controller";
import { SuppliersService } from "./suppliers/suppliers.service";

@Module({
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [SuppliersService, PurchaseOrdersService],
})
export class PurchasingModule {}
