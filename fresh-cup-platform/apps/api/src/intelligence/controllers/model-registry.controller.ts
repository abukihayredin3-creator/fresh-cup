import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PredictiveModelStage, UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { PromoteModelDto } from "../dto/promote-model.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { ModelRegistryV2Service } from "../registry/model-registry-v2.service";

/** `/ai/models` from the Phase 11 Part 2 spec's AI API surface. */
@ApiTags("ai-models")
@Controller("admin/ai/models")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class ModelRegistryController {
  constructor(private readonly registry: ModelRegistryV2Service) {}

  @Get()
  @ApiOperation({ summary: "List predictive-model registry runs, optionally filtered by modelKey" })
  listRuns(@Query("modelKey") modelKey?: string) {
    return this.registry.listRuns(modelKey);
  }

  @Get("stage/:stage")
  @ApiOperation({ summary: "List runs currently at a given deployment stage" })
  listByStage(@Param("stage") stage: PredictiveModelStage) {
    return this.registry.listByStage(stage);
  }

  @Post(":modelKey/:version/promote")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Promote a model version to a new deployment stage (admin only) — promoting to PRODUCTION automatically archives the previous PRODUCTION version",
  })
  promote(
    @Param("modelKey") modelKey: string,
    @Param("version", ParseIntPipe) version: number,
    @Body() body: PromoteModelDto,
  ) {
    return this.registry.promote(modelKey, version, body.stage);
  }
}
