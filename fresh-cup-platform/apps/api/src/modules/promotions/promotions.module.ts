import { Module } from "@nestjs/common";
import { CouponsController } from "./coupons/coupons.controller";
import { CouponsService } from "./coupons/coupons.service";

@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class PromotionsModule {}
