import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";
import type { ReasoningCategory } from "../interfaces/ai-brain.interfaces";
import { REASONING_CATEGORIES } from "./analyze-request.dto";

export class RecommendRequestDto {
  @ApiPropertyOptional({ description: "Restrict recommendations to a single branch" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    enum: REASONING_CATEGORIES,
    isArray: true,
    description: "Defaults to all categories when omitted",
  })
  @IsOptional()
  @IsArray()
  @IsIn(REASONING_CATEGORIES, { each: true })
  categories?: ReasoningCategory[];
}
