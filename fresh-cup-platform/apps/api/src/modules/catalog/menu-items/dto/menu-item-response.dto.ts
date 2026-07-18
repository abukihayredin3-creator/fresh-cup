import { ApiProperty } from "@nestjs/swagger";
import { MenuItemModifierGroupResponseDto } from "../../modifiers/dto/menu-item-modifier-group-response.dto";
import { MenuItemImageResponseDto } from "./menu-item-image-response.dto";

export class MenuItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ nullable: true })
  nameAm!: string | null;

  @ApiProperty({ nullable: true })
  descriptionEn!: string | null;

  @ApiProperty({ nullable: true })
  descriptionAm!: string | null;

  @ApiProperty({ description: "Price in ETB minor units" })
  basePrice!: number;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty({ nullable: true })
  calories!: number | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ description: "Estimated prep time in seconds" })
  prepTimeSeconds!: number;

  @ApiProperty({ nullable: true })
  stationId!: string | null;

  @ApiProperty({ type: [MenuItemImageResponseDto] })
  images!: MenuItemImageResponseDto[];

  @ApiProperty({ type: [MenuItemModifierGroupResponseDto] })
  modifierGroups!: MenuItemModifierGroupResponseDto[];
}
