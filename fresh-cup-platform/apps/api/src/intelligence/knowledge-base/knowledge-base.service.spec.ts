import { KnowledgeSourceFormat } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { RagService } from "../rag/rag.service";
import { KnowledgeBaseService } from "./knowledge-base.service";

describe("KnowledgeBaseService", () => {
  function makeService() {
    const prisma = {
      aiKnowledgeDocument: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "doc-1", updatedAt: new Date(), ...data }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "doc-1", updatedAt: new Date(), ...data }),
          ),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const rag = {
      index: jest.fn().mockResolvedValue(undefined),
      hybridRetrieve: jest.fn().mockResolvedValue([]),
      deleteIndexed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RagService>;
    const service = new KnowledgeBaseService(prisma, rag);
    return { service, prisma, rag };
  }

  it("create() writes the document and indexes it for search", async () => {
    const { service, prisma, rag } = makeService();
    const doc = await service.create({
      title: "Food Safety 101",
      category: "food-safety",
      content: "Wash hands before handling produce.",
      sourceFormat: KnowledgeSourceFormat.MARKDOWN,
    });

    expect(prisma.aiKnowledgeDocument.create).toHaveBeenCalled();
    expect(rag.index).toHaveBeenCalledWith(
      "ai-knowledge-base",
      "doc-1",
      "Food Safety 101\nWash hands before handling produce.",
      { category: "food-safety", sourceFormat: KnowledgeSourceFormat.MARKDOWN },
    );
    expect(doc.id).toBe("doc-1");
  });

  it("update() re-indexes the document after finding it", async () => {
    const { service, prisma, rag } = makeService();
    (prisma.aiKnowledgeDocument.findUnique as jest.Mock).mockResolvedValue({ id: "doc-1" });

    await service.update("doc-1", { content: "Updated content" });

    expect(prisma.aiKnowledgeDocument.update).toHaveBeenCalled();
    expect(rag.index).toHaveBeenCalled();
  });

  it("update() throws NotFoundException for a missing document", async () => {
    const { service, prisma } = makeService();
    (prisma.aiKnowledgeDocument.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.update("missing", {})).rejects.toThrow("Knowledge document not found");
  });

  it("delete() removes the document and its index entry", async () => {
    const { service, prisma, rag } = makeService();
    (prisma.aiKnowledgeDocument.findUnique as jest.Mock).mockResolvedValue({ id: "doc-1" });

    await service.delete("doc-1");

    expect(prisma.aiKnowledgeDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(rag.deleteIndexed).toHaveBeenCalledWith("ai-knowledge-base", ["doc-1"]);
  });

  it("search() returns matching documents in relevance order", async () => {
    const { service, prisma, rag } = makeService();
    (rag.hybridRetrieve as jest.Mock).mockResolvedValue([
      { id: "doc-2", score: 0.9 },
      { id: "doc-1", score: 0.5 },
    ]);
    (prisma.aiKnowledgeDocument.findMany as jest.Mock).mockResolvedValue([
      { id: "doc-1", title: "A" },
      { id: "doc-2", title: "B" },
    ]);

    const results = await service.search("food safety");
    expect(results.map((d) => d.id)).toEqual(["doc-2", "doc-1"]);
  });

  it("search() returns an empty array when nothing matches", async () => {
    const { service, prisma, rag } = makeService();
    (rag.hybridRetrieve as jest.Mock).mockResolvedValue([]);
    expect(await service.search("nothing")).toEqual([]);
    expect(prisma.aiKnowledgeDocument.findMany).not.toHaveBeenCalled();
  });
});
