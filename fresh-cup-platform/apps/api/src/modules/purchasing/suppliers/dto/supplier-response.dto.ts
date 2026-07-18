import { ApiProperty } from "@nestjs/swagger";

export class SupplierResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  contactName!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  address!: string | null;

  @ApiProperty()
  isActive!: boolean;
}
