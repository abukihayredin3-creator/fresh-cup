import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";

export class ReceivePurchaseOrderLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantityReceived!: number;
}

/** Omit `lines` to receive every line in full against its ordered quantity. */
export class ReceivePurchaseOrderDto {
  @ApiPropertyOptional({ type: [ReceivePurchaseOrderLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines?: ReceivePurchaseOrderLineDto[];
}
