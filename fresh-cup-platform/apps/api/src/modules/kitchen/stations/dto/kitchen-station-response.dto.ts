import { ApiProperty } from "@nestjs/swagger";

export class KitchenStationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;
}
