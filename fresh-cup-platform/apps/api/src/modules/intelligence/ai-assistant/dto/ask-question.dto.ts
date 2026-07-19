import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class AskQuestionDto {
  @ApiProperty({ example: "How were sales yesterday?" })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
