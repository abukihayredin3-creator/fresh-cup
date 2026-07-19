import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class DecideApprovalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
