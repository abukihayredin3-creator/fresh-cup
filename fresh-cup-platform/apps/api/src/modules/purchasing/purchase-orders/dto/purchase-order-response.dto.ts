import { ApiProperty } from "@nestjs/swagger";
import { PurchaseOrderStatus } from "@prisma/client";
import { PurchaseOrderLineResponseDto } from "./purchase-order-line-response.dto";
import { PurchaseOrderPaymentResponseDto } from "./purchase-order-payment-response.dto";

export class PurchaseOrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  supplierId!: string;

  @ApiProperty({ enum: PurchaseOrderStatus })
  status!: PurchaseOrderStatus;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ nullable: true })
  createdByUserId!: string | null;

  @ApiProperty({ nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({ nullable: true })
  receivedAt!: Date | null;

  @ApiProperty({ nullable: true })
  invoiceNumber!: string | null;

  @ApiProperty({ nullable: true })
  invoiceUrl!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [PurchaseOrderLineResponseDto] })
  lines!: PurchaseOrderLineResponseDto[];

  @ApiProperty({ type: [PurchaseOrderPaymentResponseDto] })
  payments!: PurchaseOrderPaymentResponseDto[];

  @ApiProperty({ description: "Sum of payments, in ETB minor units" })
  totalPaid!: number;
}
