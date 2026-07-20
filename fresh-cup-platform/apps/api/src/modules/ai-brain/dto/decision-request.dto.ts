import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class DecisionRequestDto {
  @ApiPropertyOptional({ description: "Restrict decisions to a single branch" })
  @IsOptional()
  @IsString()
  branchId?: string;
}
