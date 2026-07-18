import { ApiProperty } from "@nestjs/swagger";
import { PurchaseOrderStatus } from "@prisma/client";
import { PurchaseOrderLineResponseDto } from "./purchase-order-line-response.dto";

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

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [PurchaseOrderLineResponseDto] })
  lines!: PurchaseOrderLineResponseDto[];
}
