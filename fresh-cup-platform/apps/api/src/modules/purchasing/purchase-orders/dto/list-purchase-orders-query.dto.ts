import { ApiPropertyOptional } from "@nestjs/swagger";
import { PurchaseOrderStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

export class ListPurchaseOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
