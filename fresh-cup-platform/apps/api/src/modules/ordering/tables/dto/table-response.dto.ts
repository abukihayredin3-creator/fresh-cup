import { ApiProperty } from "@nestjs/swagger";

export class TableResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ description: "Opaque token embedded in the table's QR code URL" })
  qrToken!: string;

  @ApiProperty()
  isActive!: boolean;
}
