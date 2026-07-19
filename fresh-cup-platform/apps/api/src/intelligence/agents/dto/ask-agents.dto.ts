import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class AskAgentsDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  question!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
