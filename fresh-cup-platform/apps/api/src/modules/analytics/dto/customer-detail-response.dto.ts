import { ApiProperty } from "@nestjs/swagger";

export class CustomerDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  ordersCount!: number;

  @ApiProperty({ description: "ETB minor units, paid orders only" })
  totalSpend!: number;

  @ApiProperty()
  loyaltyBalance!: number;

  @ApiProperty({ nullable: true })
  lastOrderAt!: Date | null;
}
