import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateRegionDto {
  @ApiProperty({ example: "Addis Ababa" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: "AA" })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: "ET" })
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @ApiProperty({ example: "Africa/Addis_Ababa" })
  @IsString()
  @MinLength(1)
  timezone!: string;
}
