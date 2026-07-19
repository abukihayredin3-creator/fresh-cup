import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
import type { RagService } from "../rag/rag.service";
import { KnowledgeBaseIndexWorker } from "./knowledge-base-index.worker";

describe("KnowledgeBaseIndexWorker", () => {
  function makeWorker(
    ragEnabled: boolean,
    indexedIds: string[],
    candidates: {
      id: string;
      title: string;
      content: string;
      category: string;
      sourceFormat: string;
    }[],
  ) {
    const prisma = {
      vectorEntry: { findMany: jest.fn().mockResolvedValue(indexedIds.map((id) => ({ id }))) },
      aiKnowledgeDocument: { findMany: jest.fn().mockResolvedValue(candidates) },
    } as unknown as jest.Mocked<PrismaService>;
    const rag = {
      index: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RagService>;
    const config = { get: () => ragEnabled } as unknown as ConfigService<
      EnvironmentVariables,
      true
    >;

    const worker = new KnowledgeBaseIndexWorker(config, prisma, rag);
    return { worker, prisma, rag };
  }

  it("does nothing when AI_RAG_ENABLED is false", async () => {
    const { worker, prisma } = makeWorker(false, [], []);
    const count = await worker.run();
    expect(count).toBe(0);
    expect(prisma.aiKnowledgeDocument.findMany).not.toHaveBeenCalled();
  });

  it("only indexes documents not already present in the vector store", async () => {
    const { worker, rag } = makeWorker(
      true,
      ["already-indexed"],
      [
        {
          id: "already-indexed",
          title: "t1",
          content: "c1",
          category: "food-safety",
          sourceFormat: "MARKDOWN",
        },
        { id: "new-doc", title: "t2", content: "c2", category: "hr", sourceFormat: "PLAIN_TEXT" },
      ],
    );

    const count = await worker.run();
    expect(count).toBe(1);
    expect(rag.index).toHaveBeenCalledWith("ai-knowledge-base", "new-doc", "t2\nc2", {
      category: "hr",
      sourceFormat: "PLAIN_TEXT",
    });
  });

  it("does not fail the whole batch if one document's indexing throws", async () => {
    const { worker, rag } = makeWorker(
      true,
      [],
      [
        { id: "d1", title: "t1", content: "c1", category: "c", sourceFormat: "MARKDOWN" },
        { id: "d2", title: "t2", content: "c2", category: "c", sourceFormat: "MARKDOWN" },
      ],
    );
    (rag.index as jest.Mock)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    const count = await worker.run();
    expect(count).toBe(2);
    expect(rag.index).toHaveBeenCalledTimes(2);
  });
});
