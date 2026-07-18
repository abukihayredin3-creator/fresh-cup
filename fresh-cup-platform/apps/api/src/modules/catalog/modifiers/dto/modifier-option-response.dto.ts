import { ApiProperty } from "@nestjs/swagger";

export class ModifierOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ nullable: true })
  nameAm!: string | null;

  @ApiProperty({ description: "ETB minor units added to the item's base price" })
  priceDelta!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;
}
