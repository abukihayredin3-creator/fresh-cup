import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

/** Shared by every ai-copilot GET endpoint that can be scoped to a single branch. */
export class BranchScopeQueryDto {
  @ApiPropertyOptional({
    description: "Restrict to a single branch; omit for the whole organization",
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}
