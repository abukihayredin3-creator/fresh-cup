import { ApiProperty } from "@nestjs/swagger";

export class AiAssistantToolCallDto {
  @ApiProperty()
  tool!: string;

  @ApiProperty({ type: Object })
  input!: Record<string, unknown>;

  @ApiProperty({
    type: Object,
    description: "The real data returned by the tool, cited in the answer",
  })
  result!: unknown;
}

export class AiAssistantResponseDto {
  @ApiProperty()
  answer!: string;

  @ApiProperty({ enum: ["ANSWERED", "FALLBACK", "ERROR"] })
  outcome!: string;

  @ApiProperty({ type: [AiAssistantToolCallDto] })
  toolCalls!: AiAssistantToolCallDto[];
}
