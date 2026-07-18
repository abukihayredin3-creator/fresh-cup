import { Module } from "@nestjs/common";
import { KitchenStationsController } from "./stations/kitchen-stations.controller";
import { KitchenStationsService } from "./stations/kitchen-stations.service";

@Module({
  controllers: [KitchenStationsController],
  providers: [KitchenStationsService],
  exports: [KitchenStationsService],
})
export class KitchenModule {}
