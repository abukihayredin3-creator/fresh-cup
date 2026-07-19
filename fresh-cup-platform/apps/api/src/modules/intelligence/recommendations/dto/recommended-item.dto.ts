import { ApiProperty } from "@nestjs/swagger";

export class RecommendedItemDto {
  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ nullable: true })
  nameAm!: string | null;

  @ApiProperty({ description: "ETB minor units" })
  basePrice!: number;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty({ description: "Why this item was recommended, for UI copy and explainability" })
  reason!: string;

  @ApiProperty({ description: "0-1 relevance score, highest first" })
  score!: number;
}

export class RecommendationsResponseDto {
  @ApiProperty({ type: [RecommendedItemDto] })
  items!: RecommendedItemDto[];
}
