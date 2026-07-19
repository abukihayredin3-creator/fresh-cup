import { Body, Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { CoordinatorAgentService } from "./coordinator-agent.service";
import { AskAgentsDto } from "./dto/ask-agents.dto";

/** Multi-Agent AI — Phase 11 Part 3's 8 specialized agents + coordinator. */
@ApiTags("ai-agents")
@Controller("admin/ai/agents")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class AgentsController {
  constructor(private readonly coordinator: CoordinatorAgentService) {}

  @Get()
  @ApiOperation({ summary: "List the specialized agents and the keywords each routes on" })
  list() {
    return this.coordinator.listAgents();
  }

  @Post("ask")
  @ApiOperation({
    summary:
      "Route a natural-language question to the relevant specialized agent(s) and combine their answers",
  })
  ask(@CurrentUser() actor: RequestUser, @Body() dto: AskAgentsDto) {
    return this.coordinator.ask(actor, dto.question, dto.branchId);
  }
}
