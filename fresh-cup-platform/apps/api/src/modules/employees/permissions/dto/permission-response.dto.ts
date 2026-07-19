import { ApiProperty } from "@nestjs/swagger";
import { PermissionKey } from "@prisma/client";

export class PermissionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: PermissionKey })
  permission!: PermissionKey;

  @ApiProperty({ nullable: true })
  grantedByUserId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
