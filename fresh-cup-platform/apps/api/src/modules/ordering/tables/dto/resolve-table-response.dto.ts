import { ApiProperty } from "@nestjs/swagger";

/** What a QR scan resolves to — just enough for the client to start a dine-in cart. */
export class ResolveTableResponseDto {
  @ApiProperty()
  tableId!: string;

  @ApiProperty()
  tableLabel!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  branchName!: string;
}
