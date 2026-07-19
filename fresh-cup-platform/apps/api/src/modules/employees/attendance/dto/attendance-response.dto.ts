import { ApiProperty } from "@nestjs/swagger";

export class AttendanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  clockInAt!: Date;

  @ApiProperty({ nullable: true })
  clockOutAt!: Date | null;
}
