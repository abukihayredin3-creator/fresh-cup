import { ApiProperty } from "@nestjs/swagger";
import { PermissionKey } from "@prisma/client";
import { IsEnum } from "class-validator";

export class GrantPermissionDto {
  @ApiProperty({ enum: PermissionKey })
  @IsEnum(PermissionKey)
  permission!: PermissionKey;
}
