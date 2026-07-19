import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
import type { RagService } from "../rag/rag.service";
import { EmbeddingBackfillWorker } from "./embedding-backfill.worker";

describe("EmbeddingBackfillWorker", () => {
  function makeWorker(
    ragEnabled: boolean,
    indexedIds: string[],
    candidates: { id: string; title: string; content: string; domain: string; kind: string }[],
  ) {
    const prisma = {
      vectorEntry: { findMany: jest.fn().mockResolvedValue(indexedIds.map((id) => ({ id }))) },
      aiMemoryEntry: { findMany: jest.fn().mockResolvedValue(candidates) },
    } as unknown as jest.Mocked<PrismaService>;
    const rag = {
      index: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RagService>;
    const config = { get: () => ragEnabled } as unknown as ConfigService<
      EnvironmentVariables,
      true
    >;

    const worker = new EmbeddingBackfillWorker(config, prisma, rag);
    return { worker, prisma, rag };
  }

  it("does nothing when AI_RAG_ENABLED is false", async () => {
    const { worker, prisma } = makeWorker(false, [], []);
    const count = await worker.run();
    expect(count).toBe(0);
    expect(prisma.aiMemoryEntry.findMany).not.toHaveBeenCalled();
  });

  it("only indexes memory entries not already present in the vector store", async () => {
    const { worker, rag } = makeWorker(
      true,
      ["already-indexed"],
      [
        {
          id: "already-indexed",
          title: "t1",
          content: "c1",
          domain: "executive",
          kind: "EXPLANATION",
        },
        { id: "new-entry", title: "t2", content: "c2", domain: "sales-ai", kind: "RECOMMENDATION" },
      ],
    );

    const count = await worker.run();
    expect(count).toBe(1);
    expect(rag.index).toHaveBeenCalledTimes(1);
    expect(rag.index).toHaveBeenCalledWith("ai-memory", "new-entry", "t2\nc2", {
      domain: "sales-ai",
      kind: "RECOMMENDATION",
    });
  });

  it("does not fail the whole batch if one entry's indexing throws", async () => {
    const { worker, rag } = makeWorker(
      true,
      [],
      [
        { id: "e1", title: "t1", content: "c1", domain: "d", kind: "EXPLANATION" },
        { id: "e2", title: "t2", content: "c2", domain: "d", kind: "EXPLANATION" },
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
