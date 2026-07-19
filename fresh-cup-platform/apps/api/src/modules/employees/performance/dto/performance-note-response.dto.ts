import { ApiProperty } from "@nestjs/swagger";

export class PerformanceNoteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  authorUserId!: string | null;

  @ApiProperty({ nullable: true })
  rating!: number | null;

  @ApiProperty()
  note!: string;

  @ApiProperty()
  createdAt!: Date;
}
