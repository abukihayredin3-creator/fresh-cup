import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from "class-validator";

export class CreateBranchDto {
  @ApiProperty({ example: "Fresh Cup — Merkato" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: "Merkato, American Gibi, Addis Ababa" })
  @IsString()
  @MinLength(1)
  addressText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}
