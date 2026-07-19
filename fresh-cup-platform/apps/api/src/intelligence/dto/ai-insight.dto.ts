import { ApiProperty } from "@nestjs/swagger";

/**
 * Common shape every domain AI method returns a list of — Core Principles
 * 2 and 3: every recommendation carries an explanation, every prediction
 * carries a confidence score. `data` is the raw numbers the explanation is
 * grounded in, so a caller (or a manager reading the JSON directly) can
 * verify the claim rather than trust it blindly.
 */
export class AiInsightDto<T = unknown> {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  explanation!: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  confidence!: number;

  @ApiProperty({ description: "The underlying data the explanation is grounded in" })
  data!: T;

  @ApiProperty({
    required: false,
    description:
      "Set when this insight was persisted to AI memory — pass to POST /admin/ai/memory/:id/outcome",
  })
  memoryEntryId?: string;
}
