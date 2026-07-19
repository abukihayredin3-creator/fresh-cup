import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class RecordOutcomeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  source!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  recommendation!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  estimatedImpact?: number;
}
