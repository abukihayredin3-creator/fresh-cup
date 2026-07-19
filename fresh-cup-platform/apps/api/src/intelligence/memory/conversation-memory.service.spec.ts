import { AiMemoryKind } from "@prisma/client";
import type { AiMemoryService } from "./ai-memory.service";
import { ConversationMemoryService } from "./conversation-memory.service";

describe("ConversationMemoryService", () => {
  it("recalls conversation-kind entries authored by the given user", async () => {
    const memory = {
      recall: jest
        .fn()
        .mockResolvedValue([
          { id: "m1", title: "How was today?", content: "answer", createdAt: new Date() },
        ]),
    } as unknown as jest.Mocked<AiMemoryService>;
    const service = new ConversationMemoryService(memory);

    const turns = await service.recentTurns("user-1", 5);

    expect(memory.recall).toHaveBeenCalledWith({
      kind: AiMemoryKind.CONVERSATION,
      authorUserId: "user-1",
      limit: 5,
    });
    expect(turns).toEqual([
      { id: "m1", title: "How was today?", content: "answer", createdAt: expect.any(Date) },
    ]);
  });
});
