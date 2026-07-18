import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { PurchaseOrderLineInputDto } from "./purchase-order-line-input.dto";

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [PurchaseOrderLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineInputDto)
  lines!: PurchaseOrderLineInputDto[];
}
