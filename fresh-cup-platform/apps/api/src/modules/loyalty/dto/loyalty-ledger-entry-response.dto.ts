import { ApiProperty } from "@nestjs/swagger";
import { LoyaltyReason } from "@prisma/client";

export class LoyaltyLedgerEntryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  pointsDelta!: number;

  @ApiProperty({ enum: LoyaltyReason })
  reason!: LoyaltyReason;

  @ApiProperty()
  balanceAfter!: number;

  @ApiProperty({ nullable: true })
  orderId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
