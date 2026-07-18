import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrderType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  orderType!: OrderType;

  @ApiPropertyOptional({ description: "Required when orderType is DINE_IN" })
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @ApiPropertyOptional({
    description: "Required when orderType is DELIVERY; must belong to the caller",
  })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ example: "WELCOME10" })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: "Ring the bell twice" })
  @IsOptional()
  @IsString()
  notes?: string;
}
