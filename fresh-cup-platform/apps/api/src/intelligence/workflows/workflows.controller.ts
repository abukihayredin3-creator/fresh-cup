import { Body, Controller, Get, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { RunWorkflowDto } from "./dto/run-workflow.dto";
import { WorkflowEngineService } from "./workflow-engine.service";

/** AI Workflow Engine — if/then step chains, tracked as AiWorkflowDefinition/AiWorkflowRun. */
@ApiTags("ai-workflows")
@Controller("admin/ai/workflows")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class WorkflowsController {
  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  @Get()
  @ApiOperation({ summary: "List workflow definitions" })
  list() {
    return this.workflowEngine.listDefinitions();
  }

  @Get("runs")
  @ApiOperation({ summary: "List workflow runs, optionally filtered by workflowId" })
  listRuns(@Query("workflowId") workflowId?: string) {
    return this.workflowEngine.listRuns(workflowId);
  }

  @Post("low-stock-reorder/run")
  @ApiOperation({
    summary:
      "Run the low-stock auto-reorder workflow now: detect low stock -> check supplier -> draft a PO for approval -> notify -> track",
  })
  runLowStockReorder(@Body() dto: RunWorkflowDto) {
    return this.workflowEngine.runLowStockReorderWorkflow(dto.branchId);
  }
}
