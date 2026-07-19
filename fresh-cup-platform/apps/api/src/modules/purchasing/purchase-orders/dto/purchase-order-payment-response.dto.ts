import { ApiProperty } from "@nestjs/swagger";

export class PurchaseOrderPaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  purchaseOrderId!: string;

  @ApiProperty({ description: "Payment amount in ETB minor units" })
  amount!: number;

  @ApiProperty()
  method!: string;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  paidAt!: Date;
}
