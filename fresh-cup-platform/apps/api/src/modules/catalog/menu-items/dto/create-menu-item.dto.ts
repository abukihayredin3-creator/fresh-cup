import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export class CreateMenuItemDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "Avocado Mango Smoothie" })
  @IsString()
  @MinLength(1)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionAm?: string;

  @ApiProperty({ description: "Price in ETB minor units, e.g. 4550 = 45.50 ETB", example: 4550 })
  @IsInt()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  calories?: number;

  @ApiPropertyOptional({ type: [String], example: ["vegan", "no-sugar-added"] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    default: 180,
    description: "Estimated prep time in seconds — used for kitchen-queue lateness flags",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  prepTimeSeconds?: number;

  @ApiPropertyOptional({ description: "Kitchen station that prepares this item" })
  @IsOptional()
  @IsUUID()
  stationId?: string;

  @ApiPropertyOptional({
    description: "Free-form nutrition facts, e.g. { proteinG: 5, carbsG: 30 }",
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  nutrition?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSeasonal?: boolean;
}
