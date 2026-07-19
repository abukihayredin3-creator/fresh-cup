import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AskAgentsDto } from "../agents/dto/ask-agents.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { toCsv, toMarkdownBriefing, toSlideOutline } from "./copilot-export.util";
import { CopilotService } from "./copilot.service";

/** The Executive Copilot — multi-step reasoning over natural-language questions. */
@ApiTags("ai-copilot")
@Controller("admin/ai/copilot")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post("ask")
  @ApiOperation({
    summary:
      "Ask the Executive Copilot a question — runs collect/analyze-compare/forecast/explain/recommend and returns the full reasoning trace",
  })
  ask(@CurrentUser() actor: RequestUser, @Body() dto: AskAgentsDto) {
    return this.copilot.ask(actor, dto.question, dto.branchId);
  }

  @Post("export/csv")
  @ApiOperation({ summary: "Same as /ask, formatted as a CSV (opens in Excel)" })
  async exportCsv(@CurrentUser() actor: RequestUser, @Body() dto: AskAgentsDto) {
    const response = await this.copilot.ask(actor, dto.question, dto.branchId);
    return toCsv(response);
  }

  @Post("export/briefing")
  @ApiOperation({ summary: "Same as /ask, formatted as a Markdown briefing document" })
  async exportBriefing(@CurrentUser() actor: RequestUser, @Body() dto: AskAgentsDto) {
    const response = await this.copilot.ask(actor, dto.question, dto.branchId);
    return toMarkdownBriefing(response);
  }

  @Post("export/slides")
  @ApiOperation({
    summary: "Same as /ask, formatted as a slide-outline (title + bullets per slide)",
  })
  async exportSlides(@CurrentUser() actor: RequestUser, @Body() dto: AskAgentsDto) {
    const response = await this.copilot.ask(actor, dto.question, dto.branchId);
    return toSlideOutline(response);
  }
}
