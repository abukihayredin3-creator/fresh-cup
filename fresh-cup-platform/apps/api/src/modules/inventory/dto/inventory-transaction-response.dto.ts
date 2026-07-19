import { ApiProperty } from "@nestjs/swagger";
import { InventoryTransactionReason } from "@prisma/client";

export class InventoryTransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  inventoryItemId!: string;

  @ApiProperty({ description: "Signed change in stock" })
  delta!: number;

  @ApiProperty({ enum: InventoryTransactionReason })
  reason!: InventoryTransactionReason;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty({ nullable: true })
  actorUserId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
