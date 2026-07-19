import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AiAssistantService } from "./ai-assistant.service";
import { AiAssistantResponseDto } from "./dto/ai-assistant-response.dto";
import { AskQuestionDto } from "./dto/ask-question.dto";

@ApiTags("ai-assistant")
@Controller("admin/ai-assistant")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post("ask")
  @ApiOperation({
    summary:
      "Natural-language Q&A over real business data (sales, inventory, customers, forecasts). Uses Claude when ANTHROPIC_API_KEY is configured, otherwise a deterministic template router — both draw from the same tools and never fabricate figures.",
  })
  @ApiOkResponse({ type: AiAssistantResponseDto })
  async ask(
    @CurrentUser() actor: RequestUser,
    @Body() dto: AskQuestionDto,
  ): Promise<AiAssistantResponseDto> {
    return this.aiAssistantService.ask(actor, dto.question, dto.branchId);
  }
}
