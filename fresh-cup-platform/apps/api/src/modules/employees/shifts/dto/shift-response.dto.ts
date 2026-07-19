import { ApiProperty } from "@nestjs/swagger";
import { ShiftStatus } from "@prisma/client";

export class ShiftResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiProperty({ enum: ShiftStatus })
  status!: ShiftStatus;

  @ApiProperty({ nullable: true })
  notes!: string | null;
}
