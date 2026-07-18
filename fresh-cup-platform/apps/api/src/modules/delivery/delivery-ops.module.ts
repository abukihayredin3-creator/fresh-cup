import { Module } from "@nestjs/common";
import { OrderingModule } from "../ordering/ordering.module";
import { DeliveriesController } from "./deliveries/deliveries.controller";
import { DeliveriesService } from "./deliveries/deliveries.service";
import { DriverAppController } from "./deliveries/driver-app.controller";
import { DeliveryModule } from "./delivery.module";

/**
 * Separate from DeliveryModule (drivers + zones) to avoid a module import
 * cycle: OrderingModule already imports DeliveryModule for
 * DeliveryZonesService (checkout fee quoting), and DeliveriesService needs
 * OrdersService (to drive order status alongside delivery status, mirroring
 * PaymentsService -> OrdersService.confirmAfterPayment) — so this module
 * imports both instead of either importing the other.
 */
@Module({
  imports: [OrderingModule, DeliveryModule],
  controllers: [DeliveriesController, DriverAppController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveryOpsModule {}
