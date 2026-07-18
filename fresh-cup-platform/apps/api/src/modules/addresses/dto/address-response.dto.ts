import { ApiProperty } from "@nestjs/swagger";

export class AddressResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  freeText!: string;

  @ApiProperty({ nullable: true })
  lat!: number | null;

  @ApiProperty({ nullable: true })
  lng!: number | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
