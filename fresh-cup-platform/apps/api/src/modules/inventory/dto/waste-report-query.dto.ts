import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class WasteReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: "ISO date, inclusive lower bound on transaction createdAt" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO date, inclusive upper bound on transaction createdAt" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
