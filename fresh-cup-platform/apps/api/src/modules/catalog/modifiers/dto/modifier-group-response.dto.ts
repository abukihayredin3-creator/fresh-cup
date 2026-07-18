import { ApiProperty } from "@nestjs/swagger";
import { ModifierSelectionType } from "@prisma/client";
import { ModifierOptionResponseDto } from "./modifier-option-response.dto";

export class ModifierGroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

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
  isActive!: boolean;

  @ApiProperty({ type: [ModifierOptionResponseDto] })
  options!: ModifierOptionResponseDto[];
}
