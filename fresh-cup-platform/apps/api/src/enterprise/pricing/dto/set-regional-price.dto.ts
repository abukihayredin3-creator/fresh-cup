import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, IsUUID } from "class-validator";

export class SetRegionalPriceDto {
  @ApiProperty()
  @IsUUID()
  menuItemId!: string;

  @ApiProperty({ example: 15000, description: "Overridden price in minor units for this region" })
  @IsInt()
  @IsPositive()
  priceMinor!: number;
}
