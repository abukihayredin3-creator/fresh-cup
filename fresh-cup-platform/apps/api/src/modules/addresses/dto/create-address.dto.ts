import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateAddressDto {
  @ApiProperty({ example: "Home" })
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty({ example: "Behind Merkato Anwar Mosque, Addis Ababa" })
  @IsString()
  @MinLength(1)
  freeText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
