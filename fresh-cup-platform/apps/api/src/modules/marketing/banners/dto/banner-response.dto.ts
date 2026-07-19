import { ApiProperty } from "@nestjs/swagger";

export class BannerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiProperty({ nullable: true })
  linkUrl!: string | null;

  @ApiProperty({ nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ nullable: true })
  endsAt!: Date | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;
}
