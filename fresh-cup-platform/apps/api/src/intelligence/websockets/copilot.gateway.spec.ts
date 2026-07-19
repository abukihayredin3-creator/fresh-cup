import { UserRole } from "@prisma/client";
import type { JwtService } from "@nestjs/jwt";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { CopilotService } from "../copilot/copilot.service";
import type { CopilotStep } from "../copilot/copilot.types";
import { CopilotGateway } from "./copilot.gateway";

describe("CopilotGateway", () => {
  function makeGateway() {
    const jwtService = {} as unknown as jest.Mocked<JwtService>;
    const config = {} as unknown as jest.Mocked<ConfigService<EnvironmentVariables, true>>;
    const copilot = {
      ask: jest.fn().mockImplementation(async (_actor, _question, _branchId, onStep) => {
        onStep?.({ step: "collect", label: "l", tookMs: 1, summary: "s" } as CopilotStep);
        return {
          question: "q",
          steps: [],
          agentAnswers: [],
          decisionReport: null,
          forecast: null,
          explanation: "",
          recommendations: [],
          confidence: 0.5,
          generatedAt: new Date().toISOString(),
        };
      }),
    } as unknown as jest.Mocked<CopilotService>;
    const gateway = new CopilotGateway(jwtService, config, copilot);
    return { gateway, copilot };
  }

  function fakeSocket(user?: { id: string; role: UserRole; branchId: string | null }) {
    return { data: { user }, emit: jest.fn() } as never;
  }

  it("rejects when the socket has no authenticated user", async () => {
    const { gateway } = makeGateway();
    const ack = await gateway.ask(fakeSocket(undefined), { question: "How was this week?" });
    expect(ack).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects a CUSTOMER role", async () => {
    const { gateway } = makeGateway();
    const socket = fakeSocket({ id: "u1", role: UserRole.CUSTOMER, branchId: null });
    const ack = await gateway.ask(socket, { question: "How was this week?" });
    expect(ack).toEqual({ ok: false, error: "forbidden" });
  });

  it("streams a copilot.step event per finished step, then copilot.done", async () => {
    const { gateway } = makeGateway();
    const socket = fakeSocket({ id: "u1", role: UserRole.MANAGER, branchId: "b1" });

    const ack = await gateway.ask(socket, { question: "How was this week?", branchId: "b1" });

    expect(ack).toEqual({ ok: true });
    expect((socket as { emit: jest.Mock }).emit).toHaveBeenCalledWith(
      "copilot.step",
      expect.objectContaining({ step: "collect" }),
    );
    expect((socket as { emit: jest.Mock }).emit).toHaveBeenCalledWith(
      "copilot.done",
      expect.objectContaining({ confidence: 0.5 }),
    );
  });
});
