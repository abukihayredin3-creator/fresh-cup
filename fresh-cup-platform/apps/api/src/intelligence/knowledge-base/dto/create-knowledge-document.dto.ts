import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { KnowledgeSourceFormat } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateKnowledgeDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ description: "e.g. 'food-safety', 'hr-policy', 'recipe', 'architecture'" })
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiProperty({
    description:
      "Plain-text/Markdown content actually indexed. If the source was a PDF/DOCX/image, extract the text before submitting — this platform does not parse binary formats itself.",
  })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ enum: KnowledgeSourceFormat, default: KnowledgeSourceFormat.MARKDOWN })
  @IsOptional()
  @IsEnum(KnowledgeSourceFormat)
  sourceFormat?: KnowledgeSourceFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
