import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AskAssistantDto } from "../dto/ask-assistant.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { AssistantAiService } from "../services/assistant-ai.service";

@ApiTags("ai-assistant")
@Controller("admin/ai/assistant")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class AssistantAiController {
  constructor(private readonly assistantAi: AssistantAiService) {}

  @Post("ask")
  @ApiOperation({
    summary:
      "Ask the Restaurant Intelligence Platform a free-text question — routes to the same domain AI services the dashboards use, via whichever LLM_PROVIDER is configured",
  })
  ask(@CurrentUser() actor: RequestUser, @Body() body: AskAssistantDto) {
    return this.assistantAi.ask(actor, body.question, body.branchId);
  }
}
