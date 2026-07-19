import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BannersController } from "./banners/banners.controller";
import { BannersService } from "./banners/banners.service";
import { CampaignsController } from "./campaigns/campaigns.controller";
import { CampaignsService } from "./campaigns/campaigns.service";
import { GiftCardsController } from "./gift-cards/gift-cards.controller";
import { GiftCardsService } from "./gift-cards/gift-cards.service";
import { ReferralsController } from "./referrals/referrals.controller";
import { ReferralsService } from "./referrals/referrals.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BannersController, GiftCardsController, ReferralsController, CampaignsController],
  providers: [BannersService, GiftCardsService, ReferralsService, CampaignsService],
})
export class MarketingModule {}
