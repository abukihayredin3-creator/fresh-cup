import { ApiPropertyOptional } from "@nestjs/swagger";
import { ForecastGranularity, ForecastMetric } from "@prisma/client";
import { IsEnum, IsOptional, IsUUID } from "class-validator";

export class ForecastQueryDto {
  @ApiPropertyOptional({ enum: ForecastMetric, default: ForecastMetric.SALES_REVENUE })
  @IsOptional()
  @IsEnum(ForecastMetric)
  metric?: ForecastMetric;

  @ApiPropertyOptional({ enum: ForecastGranularity, default: ForecastGranularity.DAILY })
  @IsOptional()
  @IsEnum(ForecastGranularity)
  granularity?: ForecastGranularity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
