import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class KitchenQueueQueryDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({ description: "Only orders with at least one item routed to this station" })
  @IsOptional()
  @IsUUID()
  stationId?: string;
}
