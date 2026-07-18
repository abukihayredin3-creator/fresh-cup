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
