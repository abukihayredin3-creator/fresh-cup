import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, IsUUID } from "class-validator";

const SCENARIO_TYPES = ["price_change", "promotion", "staffing_change"] as const;

export class RunScenarioDto {
  @ApiProperty({ enum: SCENARIO_TYPES })
  @IsIn(SCENARIO_TYPES)
  type!: "price_change" | "promotion" | "staffing_change";

  @ApiProperty({ description: "Percent magnitude of the change, e.g. 5 for +5%" })
  @IsNumber()
  magnitudePercent!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: "Digital Twin only: number of days to project", default: 14 })
  @IsOptional()
  @IsNumber()
  horizonDays?: number;

  @ApiPropertyOptional({
    description: "Digital Twin only: days over which the effect ramps to full strength",
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  rampDays?: number;
}
