import { ApiPropertyOptional } from "@nestjs/swagger";
import { InventoryTransactionReason } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class InventoryHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InventoryTransactionReason })
  @IsOptional()
  @IsEnum(InventoryTransactionReason)
  reason?: InventoryTransactionReason;
}
