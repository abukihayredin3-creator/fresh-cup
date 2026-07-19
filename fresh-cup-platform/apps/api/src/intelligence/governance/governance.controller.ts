import { Body, Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { EvaluatePolicyDto } from "./dto/evaluate-policy.dto";
import { PolicyEngineService } from "./policy-engine.service";
import { PromptRegistryService } from "./prompt-registry.service";

/**
 * AI Governance — prompt history + a policy-engine dry-run tool. Model
 * history already lives at `GET /admin/ai/models` (Part 2's
 * ModelRegistryV2Service) and approval history at `GET
 * /admin/ai/approvals` — not duplicated here.
 */
@ApiTags("ai-governance")
@Controller("admin/ai/governance")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class GovernanceController {
  constructor(
    private readonly promptRegistry: PromptRegistryService,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  @Get("prompts")
  @ApiOperation({ summary: "List every domain's system prompt with a change-fingerprint" })
  listPrompts() {
    return this.promptRegistry.list();
  }

  @Post("policy/evaluate")
  @ApiOperation({
    summary:
      "Dry-run the governance policy engine against a hypothetical action — does not create anything",
  })
  evaluatePolicy(@Body() dto: EvaluatePolicyDto) {
    return this.policyEngine.evaluate(dto.actionType, dto.payload);
  }
}
