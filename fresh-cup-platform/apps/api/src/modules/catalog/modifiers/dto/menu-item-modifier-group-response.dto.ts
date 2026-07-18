import { ApiProperty } from "@nestjs/swagger";
import { ModifierSelectionType } from "@prisma/client";
import { ModifierOptionResponseDto } from "./modifier-option-response.dto";

/** The shape a menu item embeds for cart/checkout to know how it can be customized. */
export class MenuItemModifierGroupResponseDto {
  @ApiProperty({ description: "The attachment link id (used to update/detach)" })
  id!: string;

  @ApiProperty()
  modifierGroupId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ nullable: true })
  nameAm!: string | null;

  @ApiProperty({ enum: ModifierSelectionType })
  selectionType!: ModifierSelectionType;

  @ApiProperty()
  minSelect!: number;

  @ApiProperty({ nullable: true })
  maxSelect!: number | null;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ type: [ModifierOptionResponseDto] })
  options!: ModifierOptionResponseDto[];
}
