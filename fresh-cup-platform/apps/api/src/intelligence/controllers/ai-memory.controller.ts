import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { MemoryEntryQueryDto } from "../dto/memory-entry-query.dto";
import { RecordSuggestionOutcomeDto } from "../dto/record-suggestion-outcome.dto";
import { AiMemoryEntryEntity } from "../entities/ai-memory-entry.entity";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { AiMemoryService } from "../memory/ai-memory.service";

/**
 * Read/decision-tracking surface over AiMemoryService — Core Principle 4:
 * every AI-generated recommendation, and every manager's accept/reject
 * decision on it, is auditable here.
 */
@ApiTags("ai-memory")
@Controller("admin/ai/memory")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class AiMemoryController {
  constructor(private readonly memory: AiMemoryService) {}

  @Get()
  @ApiOperation({
    summary:
      "Recall recent AI memory entries (conversations, decisions, recommendations, outcomes)",
  })
  @ApiOkResponse({ type: [AiMemoryEntryEntity] })
  recall(@Query() query: MemoryEntryQueryDto) {
    return this.memory.recall(query);
  }

  @Post(":id/outcome")
  @ApiOperation({
    summary: "Record whether a manager accepted or rejected a prior AI recommendation",
  })
  recordOutcome(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() body: RecordSuggestionOutcomeDto,
  ) {
    return this.memory.recordSuggestionOutcome(id, body.accepted, actor.id);
  }
}
