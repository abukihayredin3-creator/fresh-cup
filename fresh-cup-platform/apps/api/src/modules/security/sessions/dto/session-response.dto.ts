import { ApiProperty } from "@nestjs/swagger";

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;
}
