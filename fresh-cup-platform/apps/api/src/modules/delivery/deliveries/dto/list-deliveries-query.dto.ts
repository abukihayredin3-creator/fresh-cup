import { ApiPropertyOptional } from "@nestjs/swagger";
import { DeliveryStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

export class ListDeliveriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: DeliveryStatus })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;
}
