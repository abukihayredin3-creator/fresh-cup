import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ModifierSelectionType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateModifierGroupDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "Size" })
  @IsString()
  @MinLength(1)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAm?: string;

  @ApiProperty({
    enum: ModifierSelectionType,
    description: "SINGLE = radio (e.g. Size), MULTIPLE = checkboxes (e.g. Add-ons)",
  })
  @IsEnum(ModifierSelectionType)
  selectionType!: ModifierSelectionType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @ApiPropertyOptional({ description: "Omit for unlimited (MULTIPLE only)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSelect?: number;
}
