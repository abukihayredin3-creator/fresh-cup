import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
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

  @ApiPropertyOptional({ description: "User id of the branch manager" })
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
