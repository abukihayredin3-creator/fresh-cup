import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsPositive, IsUUID } from "class-validator";

export class CreateGiftCardDto {
  @ApiProperty({ description: "Starting balance in ETB minor units" })
  @IsInt()
  @IsPositive()
  initialBalance!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issuedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
