import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateFranchiseDto {
  @ApiProperty({ example: "Kaldi Franchise Group" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: "User id of the franchise owner" })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}
