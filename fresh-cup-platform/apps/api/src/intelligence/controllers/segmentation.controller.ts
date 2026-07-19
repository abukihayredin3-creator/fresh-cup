import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import {
  CustomerSegmentationService,
  type ClusteringStrategyName,
} from "../segmentation/customer-segmentation.service";

@ApiTags("ai-segmentation")
@Controller("admin/ai/segmentation")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class SegmentationController {
  constructor(private readonly segmentation: CustomerSegmentationService) {}

  @Get()
  @ApiOperation({
    summary:
      "Cluster customers into High Value/VIP/Occasional/New/Dormant/At Risk/Lost — ?strategy=rule-based (default) or kmeans",
  })
  segment(
    @CurrentUser() actor: RequestUser,
    @Query("branchId") branchId?: string,
    @Query("strategy") strategy?: ClusteringStrategyName,
  ) {
    return this.segmentation.segment(actor, branchId, strategy);
  }

  @Get("summary")
  @ApiOperation({ summary: "Customer counts per segment" })
  summary(
    @CurrentUser() actor: RequestUser,
    @Query("branchId") branchId?: string,
    @Query("strategy") strategy?: ClusteringStrategyName,
  ) {
    return this.segmentation.summary(actor, branchId, strategy);
  }
}
