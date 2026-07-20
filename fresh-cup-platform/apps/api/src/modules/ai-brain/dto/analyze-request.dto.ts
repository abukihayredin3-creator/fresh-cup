import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { ReasoningCategory } from "../interfaces/ai-brain.interfaces";

export const REASONING_CATEGORIES = ["sales", "inventory", "customer", "operational"] as const;

export class AnalyzeRequestDto {
  @ApiProperty({ enum: REASONING_CATEGORIES })
  @IsIn(REASONING_CATEGORIES)
  category!: ReasoningCategory;

  @ApiPropertyOptional({ description: "Restrict analysis to a single branch" })
  @IsOptional()
  @IsString()
  branchId?: string;
}
