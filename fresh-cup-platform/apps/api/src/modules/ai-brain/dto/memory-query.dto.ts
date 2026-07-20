import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class MemoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Restrict to a single branch" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Memory type, e.g. "SALES_DROP", "REASONING_SALES"' })
  @IsOptional()
  @IsString()
  memoryType?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minImportance?: number;
}
