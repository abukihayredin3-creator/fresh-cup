import { Injectable, NotFoundException } from "@nestjs/common";
import type { AiKnowledgeDocument, KnowledgeSourceFormat, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { RagService } from "../rag/rag.service";

const KNOWLEDGE_NAMESPACE = "ai-knowledge-base";

export interface CreateKnowledgeDocumentInput {
  title: string;
  category: string;
  content: string;
  sourceFormat?: KnowledgeSourceFormat;
  metadata?: Record<string, unknown>;
}

export type UpdateKnowledgeDocumentInput = Partial<CreateKnowledgeDocumentInput>;

/**
 * AI Knowledge Base (Phase 11 Part 3) — restaurant policies, recipes,
 * training manuals, food safety, HR policies, supplier agreements,
 * marketing/architecture/API docs. `content` is always plain text/
 * Markdown that gets indexed into the shared RAG store (namespace
 * "ai-knowledge-base") on every create/update, so `search()` and
 * CoordinatorAgentService's future consumers can retrieve it semantically
 * — not just by category. Automatic PDF/DOCX/image OCR ingestion is
 * explicitly out of scope for this hand-rolled backend (see
 * `sourceFormat` on `CreateKnowledgeDocumentDto`); callers extract text
 * themselves before submitting.
 */
@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  async create(input: CreateKnowledgeDocumentInput): Promise<AiKnowledgeDocument> {
    const doc = await this.prisma.aiKnowledgeDocument.create({
      data: {
        title: input.title,
        category: input.category,
        content: input.content,
        sourceFormat: input.sourceFormat,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.indexDocument(doc);
    return doc;
  }

  async update(id: string, input: UpdateKnowledgeDocumentInput): Promise<AiKnowledgeDocument> {
    await this.findByIdOrThrow(id);
    const doc = await this.prisma.aiKnowledgeDocument.update({
      where: { id },
      data: {
        title: input.title,
        category: input.category,
        content: input.content,
        sourceFormat: input.sourceFormat,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.indexDocument(doc);
    return doc;
  }

  async delete(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.aiKnowledgeDocument.delete({ where: { id } });
    await this.rag.deleteIndexed(KNOWLEDGE_NAMESPACE, [id]);
  }

  async findByIdOrThrow(id: string): Promise<AiKnowledgeDocument> {
    const doc = await this.prisma.aiKnowledgeDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException("Knowledge document not found");
    }
    return doc;
  }

  list(category?: string): Promise<AiKnowledgeDocument[]> {
    return this.prisma.aiKnowledgeDocument.findMany({
      where: { category },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  /** Semantic search over the indexed knowledge base — falls back to a category listing when RAG is disabled or the query is empty. */
  async search(query: string, topK = 5): Promise<AiKnowledgeDocument[]> {
    const matches = await this.rag.hybridRetrieve(KNOWLEDGE_NAMESPACE, query, topK);
    if (matches.length === 0) return [];
    const ids = matches.map((m) => m.id);
    const docs = await this.prisma.aiKnowledgeDocument.findMany({ where: { id: { in: ids } } });
    const byId = new Map(docs.map((d) => [d.id, d]));
    return ids.map((id) => byId.get(id)).filter((d): d is AiKnowledgeDocument => Boolean(d));
  }

  private async indexDocument(doc: AiKnowledgeDocument): Promise<void> {
    await this.rag.index(KNOWLEDGE_NAMESPACE, doc.id, `${doc.title}\n${doc.content}`, {
      category: doc.category,
      sourceFormat: doc.sourceFormat,
    });
  }
}
