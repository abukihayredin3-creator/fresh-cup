import { ApiProperty } from "@nestjs/swagger";
import { IsLatitude, IsLongitude, IsUUID } from "class-validator";

export class DeliveryQuoteRequestDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @IsLongitude()
  lng!: number;
}
