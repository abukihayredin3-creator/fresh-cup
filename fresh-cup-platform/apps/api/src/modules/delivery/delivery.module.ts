import { Module } from "@nestjs/common";
import { DriversController } from "./drivers/drivers.controller";
import { DriversService } from "./drivers/drivers.service";
import { DeliveryZonesController } from "./zones/delivery-zones.controller";
import { DeliveryZonesService } from "./zones/delivery-zones.service";

@Module({
  controllers: [DriversController, DeliveryZonesController],
  providers: [DriversService, DeliveryZonesService],
  exports: [DriversService, DeliveryZonesService],
})
export class DeliveryModule {}
