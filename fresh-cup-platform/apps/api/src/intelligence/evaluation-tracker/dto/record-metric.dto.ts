import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class RecordMetricDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  metricName!: string;

  @ApiProperty()
  @IsNumber()
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
