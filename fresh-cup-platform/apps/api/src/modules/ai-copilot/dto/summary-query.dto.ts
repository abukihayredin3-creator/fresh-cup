import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { SummaryPeriod } from "../services/executive-summary.service";

const SUMMARY_PERIODS = ["day", "week"] as const;

export class SummaryQueryDto {
  @ApiPropertyOptional({
    description: "Restrict to a single branch; omit for the whole organization",
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ enum: SUMMARY_PERIODS, default: "week" })
  @IsOptional()
  @IsIn(SUMMARY_PERIODS)
  period?: SummaryPeriod;
}
