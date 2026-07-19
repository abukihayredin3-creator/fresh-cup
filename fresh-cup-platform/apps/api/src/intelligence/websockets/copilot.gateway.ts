import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { UserRole } from "@prisma/client";
import type { Socket } from "socket.io";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { AccessTokenPayload } from "../../modules/auth/token.service";
import { CopilotService } from "../copilot/copilot.service";
import type { CopilotStep } from "../copilot/copilot.types";

interface AuthenticatedSocket extends Socket {
  data: { user: RequestUser };
}

interface AskAck {
  ok: boolean;
  error?: "unauthenticated" | "forbidden";
}

/**
 * /ws/ai-copilot — streams the Executive Copilot's reasoning trace as it
 * actually happens (`copilot.step` per finished step, `copilot.done` with
 * the full response) rather than making the client wait for one big HTTP
 * response. This is real step-level streaming — `CopilotService.ask()`'s
 * `onStep` callback fires the instant each step completes — but it is NOT
 * token-level LLM streaming; no `LlmProvider` in this platform exposes a
 * streaming completion API yet, a documented scope boundary rather than
 * a silent gap.
 */
@WebSocketGateway({ namespace: "/ws/ai-copilot", cors: { origin: true, credentials: true } })
export class CopilotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CopilotGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly copilot: CopilotService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      });
      (socket as AuthenticatedSocket).data.user = {
        id: payload.sub,
        role: payload.role,
        branchId: payload.branchId,
      };
    } catch {
      this.logger.warn(`Rejected unauthenticated socket connection ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Socket disconnected: ${socket.id}`);
  }

  @SubscribeMessage("copilot.ask")
  async ask(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { question: string; branchId?: string },
  ): Promise<AskAck> {
    const user = socket.data.user;
    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }
    if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
      return { ok: false, error: "forbidden" };
    }

    const response = await this.copilot.ask(
      user,
      data.question,
      data.branchId,
      (step: CopilotStep) => {
        socket.emit("copilot.step", step);
      },
    );
    socket.emit("copilot.done", response);
    return { ok: true };
  }

  private extractToken(socket: Socket): string {
    const authPayload = socket.handshake.auth as { token?: unknown } | undefined;
    if (typeof authPayload?.token === "string" && authPayload.token.length > 0) {
      return authPayload.token;
    }
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice("Bearer ".length);
    }
    const queryToken = socket.handshake.query.token;
    if (typeof queryToken === "string" && queryToken.length > 0) {
      return queryToken;
    }
    throw new Error("No token provided");
  }
}
