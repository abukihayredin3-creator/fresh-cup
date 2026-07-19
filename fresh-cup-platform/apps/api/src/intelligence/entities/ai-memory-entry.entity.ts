import { ApiProperty } from "@nestjs/swagger";
import { AiMemoryKind } from "@prisma/client";

/** Swagger-facing shape of a persisted AiMemoryEntry row (embedding vector omitted — internal to RAG). */
export class AiMemoryEntryEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AiMemoryKind })
  kind!: AiMemoryKind;

  @ApiProperty()
  domain!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ required: false, nullable: true })
  branchId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
