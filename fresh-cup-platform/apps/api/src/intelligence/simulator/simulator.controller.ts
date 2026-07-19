import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { DigitalTwinService } from "./digital-twin.service";
import { RunScenarioDto } from "./dto/run-scenario.dto";
import { ScenarioSimulatorService } from "./scenario-simulator.service";

/** Scenario Simulator + Digital Twin — read-only "what if" projections. */
@ApiTags("ai-simulator")
@Controller("admin/ai/simulator")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class SimulatorController {
  constructor(
    private readonly scenarioSimulator: ScenarioSimulatorService,
    private readonly digitalTwin: DigitalTwinService,
  ) {}

  @Post("scenario")
  @ApiOperation({
    summary: "Run a single-point 'what if' scenario (price/promotion/staffing change)",
  })
  simulate(@CurrentUser() actor: RequestUser, @Body() dto: RunScenarioDto) {
    return this.scenarioSimulator.simulate(actor, {
      type: dto.type,
      magnitudePercent: dto.magnitudePercent,
      branchId: dto.branchId,
    });
  }

  @Post("digital-twin")
  @ApiOperation({
    summary:
      "Run the same scenario projected over a horizon (Digital Twin) — read-only, never touches production data",
  })
  runDigitalTwin(@CurrentUser() actor: RequestUser, @Body() dto: RunScenarioDto) {
    return this.digitalTwin.run(
      actor,
      { type: dto.type, magnitudePercent: dto.magnitudePercent, branchId: dto.branchId },
      dto.horizonDays,
      dto.rampDays,
    );
  }
}
