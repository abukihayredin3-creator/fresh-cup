import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListSegmentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: "Filter to a single RFM segment label",
    enum: ["Champions", "Loyal Customers", "New Customers", "At Risk", "Need Attention", "Lost"],
  })
  @IsOptional()
  @IsIn(["Champions", "Loyal Customers", "New Customers", "At Risk", "Need Attention", "Lost"])
  segment?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
