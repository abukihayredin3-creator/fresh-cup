import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { AiMemoryKind } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { RagService } from "../rag/rag.service";
import { AiMemoryService } from "./ai-memory.service";

describe("AiMemoryService", () => {
  function makeService(memoryEnabled: boolean, ragEnabled = false) {
    const prisma = {
      aiMemoryEntry: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "mem-1", createdAt: new Date(), ...data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    const config = {
      get: (key: string) => (key === "AI_MEMORY_ENABLED" ? memoryEnabled : ragEnabled),
    } as unknown as ConfigService<EnvironmentVariables, true>;

    const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const rag = {
      index: jest.fn().mockResolvedValue(undefined),
      retrieve: jest.fn(),
    } as unknown as RagService;

    const service = new AiMemoryService(prisma, config, eventEmitter, rag);
    return { service, prisma, eventEmitter, rag };
  }

  it("is a no-op when AI_MEMORY_ENABLED is false", async () => {
    const { service, prisma, eventEmitter } = makeService(false);
    const id = await service.remember({
      kind: AiMemoryKind.RECOMMENDATION,
      domain: "executive",
      title: "t",
      content: "c",
    });
    expect(id).toBeNull();
    expect(prisma.aiMemoryEntry.create as jest.Mock).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("writes a memory entry, emits an event, and indexes it for RAG", async () => {
    const { service, prisma, eventEmitter, rag } = makeService(true);
    const id = await service.remember({
      kind: AiMemoryKind.RECOMMENDATION,
      domain: "executive",
      title: "Revenue up",
      content: "Revenue rose 12% this week",
      branchId: "branch-1",
    });

    expect(id).toBe("mem-1");
    expect(prisma.aiMemoryEntry.create).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "ai.memory.recorded",
      expect.objectContaining({ memoryEntryId: "mem-1", domain: "executive" }),
    );
    expect(rag.index).toHaveBeenCalled();
  });

  it("records accepted/rejected suggestion outcomes as new memory entries and emits the matching event", async () => {
    const { service, prisma, eventEmitter } = makeService(true);
    (prisma.aiMemoryEntry.findUnique as jest.Mock).mockResolvedValue({
      id: "mem-1",
      domain: "inventory-ai",
      title: "Reorder mango",
      content: "Reorder 20kg mango",
      metadata: null,
      branchId: "branch-1",
    });

    await service.recordSuggestionOutcome("mem-1", true, "user-1");

    expect(prisma.aiMemoryEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: AiMemoryKind.ACCEPTED_SUGGESTION }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "ai.suggestion.accepted",
      expect.objectContaining({ memoryEntryId: "mem-1", actorUserId: "user-1" }),
    );
  });

  it("recallRelevant falls back to recency-based recall when RAG is disabled", async () => {
    const { service, prisma, rag } = makeService(true, false);
    await service.recallRelevant("executive", "how were sales");
    expect(rag.retrieve).not.toHaveBeenCalled();
    expect(prisma.aiMemoryEntry.findMany).toHaveBeenCalled();
  });
});
