import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class EnterpriseDateRangeDto {
  @ApiPropertyOptional({ description: "ISO date, inclusive. Defaults to 30 days before `to`." })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date, inclusive. Defaults to today." })
  @IsOptional()
  @IsDateString()
  to?: string;
}
