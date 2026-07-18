import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export class CreateDeliveryZoneDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "Merkato Core" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsLatitude()
  centerLat!: number;

  @ApiProperty()
  @IsLongitude()
  centerLng!: number;

  @ApiProperty({ description: "Catchment radius in kilometers" })
  @IsNumber()
  @Min(0.1)
  radiusKm!: number;

  @ApiProperty({ description: "ETB minor units" })
  @IsInt()
  @Min(0)
  baseFee!: number;

  @ApiPropertyOptional({
    description: "ETB minor units per km, added on top of baseFee",
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  perKmFee?: number;
}
