import { ApiProperty } from "@nestjs/swagger";

export class OnboardTenantResponseDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  organizationSlug!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  adminUserId!: string;
}
