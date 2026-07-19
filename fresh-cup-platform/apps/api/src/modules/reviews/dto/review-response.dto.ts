import { ApiProperty } from "@nestjs/swagger";

export class ReviewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  userName!: string;

  @ApiProperty({ nullable: true })
  orderId!: string | null;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating!: number;

  @ApiProperty({ nullable: true })
  comment!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
