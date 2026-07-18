import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class DateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: "ISO date, inclusive. Defaults to 30 days before `to`." })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date, inclusive. Defaults to today." })
  @IsOptional()
  @IsDateString()
  to?: string;
}
