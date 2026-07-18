import { ApiProperty } from "@nestjs/swagger";

export class AuditLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    nullable: true,
    description: "null for system-triggered actions (e.g. event listeners)",
  })
  actorUserId!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ nullable: true })
  entityId!: string | null;

  @ApiProperty({ nullable: true, description: "Response body captured after the mutation" })
  after!: unknown;

  @ApiProperty()
  createdAt!: Date;
}
