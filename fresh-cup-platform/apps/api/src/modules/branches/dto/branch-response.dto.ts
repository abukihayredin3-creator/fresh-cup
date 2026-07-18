import { ApiProperty } from "@nestjs/swagger";

export class BranchResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  addressText!: string;

  @ApiProperty({ nullable: true })
  lat!: number | null;

  @ApiProperty({ nullable: true })
  lng!: number | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  isActive!: boolean;
}
