import { ApiProperty } from "@nestjs/swagger";
import { PaymentMethod } from "@prisma/client";
import { IsEnum, IsUUID } from "class-validator";

export class InitiatePaymentDto {
  @ApiProperty()
  @IsUUID()
  orderId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
