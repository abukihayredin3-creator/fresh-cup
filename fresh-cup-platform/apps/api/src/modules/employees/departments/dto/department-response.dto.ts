import { ApiProperty } from "@nestjs/swagger";

export class DepartmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty()
  name!: string;
}
