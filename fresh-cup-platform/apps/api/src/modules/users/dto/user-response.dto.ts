import { ApiProperty } from "@nestjs/swagger";
import { Locale, UserRole } from "@prisma/client";

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty({ enum: Locale })
  locale!: Locale;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

/**
 * Admin-only view of a user — adds fields that must never appear in a
 * customer's own `/users/me` response (salary, owner flag, 2FA state).
 * Returned only from `admin/users*` endpoints.
 */
export class AdminUserResponseDto extends UserResponseDto {
  @ApiProperty()
  isOwner!: boolean;

  @ApiProperty({ nullable: true })
  departmentId!: string | null;

  @ApiProperty({ nullable: true, description: "Employee salary placeholder — admin only" })
  salary!: number | null;

  @ApiProperty()
  twoFactorEnabled!: boolean;
}
