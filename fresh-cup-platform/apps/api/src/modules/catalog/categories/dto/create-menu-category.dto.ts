import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateMenuCategoryDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "Fresh Juices" })
  @IsString()
  @MinLength(1)
  nameEn!: string;

  @ApiPropertyOptional({ example: "ትኩስ ጭማቂዎች" })
  @IsOptional()
  @IsString()
  nameAm?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
