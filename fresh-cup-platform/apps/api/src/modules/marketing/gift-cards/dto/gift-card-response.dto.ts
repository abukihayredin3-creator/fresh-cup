import { ApiProperty } from "@nestjs/swagger";

export class GiftCardResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ description: "ETB minor units" })
  initialBalance!: number;

  @ApiProperty({ description: "ETB minor units" })
  currentBalance!: number;

  @ApiProperty({ nullable: true })
  issuedToUserId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
