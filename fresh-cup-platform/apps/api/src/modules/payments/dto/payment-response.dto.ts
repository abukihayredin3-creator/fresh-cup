import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentMethod, PaymentProvider, PaymentStatus } from "@prisma/client";

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ nullable: true })
  providerReference!: string | null;

  @ApiProperty({ description: "ETB minor units" })
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty()
  initiatedAt!: Date;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;
}

export class InitiatePaymentResponseDto extends PaymentResponseDto {
  @ApiPropertyOptional({ nullable: true, description: "Hosted checkout URL (Chapa only)" })
  checkoutUrl!: string | null;
}
