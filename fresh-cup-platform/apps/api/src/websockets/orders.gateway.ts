import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { UserRole } from "@prisma/client";
import type { Server, Socket } from "socket.io";
import type { EnvironmentVariables } from "../common/config/env.validation";
import {
  ORDER_EVENTS,
  type OrderCreatedEvent,
  type OrderStatusChangedEvent,
} from "../common/events/order-events";
import type { RequestUser } from "../common/types/request-user.interface";
import { PrismaService } from "../database/prisma.service";
import type { AccessTokenPayload } from "../modules/auth/token.service";

interface AuthenticatedSocket extends Socket {
  data: { user: RequestUser };
}

interface SubscribeAck {
  ok: boolean;
  error?: "unauthenticated" | "not_found" | "forbidden";
}

/**
 * /ws/orders — customer order-status tracking (`order:{id}` room) and
 * kitchen/staff live order feed (`branch:{id}` room), per docs/API_DESIGN.md.
 * Single-instance only for now: horizontal scaling needs the Socket.IO
 * Redis adapter (ARCHITECTURE.md's stated target), deferred until a second
 * API instance actually exists to justify it.
 */
@WebSocketGateway({ namespace: "/ws/orders", cors: { origin: true, credentials: true } })
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      });
      const user: RequestUser = { id: payload.sub, role: payload.role, branchId: payload.branchId };
      (socket as AuthenticatedSocket).data.user = user;

      // Kitchen/staff get their branch feed automatically; admins (not tied
      // to one branch) and customers (tied to a specific order, not learned
      // until checkout) subscribe explicitly via the messages below.
      if ((user.role === UserRole.STAFF || user.role === UserRole.MANAGER) && user.branchId) {
        await socket.join(`branch:${user.branchId}`);
      }
    } catch {
      this.logger.warn(`Rejected unauthenticated socket connection ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Socket disconnected: ${socket.id}`);
  }

  @SubscribeMessage("subscribeOrder")
  async subscribeOrder(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { orderId: string },
  ): Promise<SubscribeAck> {
    const user = socket.data.user;
    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }

    const order = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!order) {
      return { ok: false, error: "not_found" };
    }

    const canView =
      order.userId === user.id ||
      user.role === UserRole.ADMIN ||
      ((user.role === UserRole.STAFF || user.role === UserRole.MANAGER) &&
        user.branchId === order.branchId);
    if (!canView) {
      return { ok: false, error: "forbidden" };
    }

    await socket.join(`order:${order.id}`);
    return { ok: true };
  }

  @SubscribeMessage("subscribeBranch")
  async subscribeBranch(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { branchId: string },
  ): Promise<SubscribeAck> {
    const user = socket.data.user;
    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }
    if (user.role === UserRole.CUSTOMER) {
      return { ok: false, error: "forbidden" };
    }
    if (user.role !== UserRole.ADMIN && user.branchId !== data.branchId) {
      return { ok: false, error: "forbidden" };
    }

    await socket.join(`branch:${data.branchId}`);
    return { ok: true };
  }

  @OnEvent(ORDER_EVENTS.CREATED)
  handleOrderCreated(event: OrderCreatedEvent): void {
    this.server.to(`order:${event.orderId}`).emit("order.created", event);
  }

  @OnEvent(ORDER_EVENTS.STATUS_CHANGED)
  handleOrderStatusChanged(event: OrderStatusChangedEvent): void {
    this.server.to(`order:${event.orderId}`).emit("order.status_changed", event);
    this.server.to(`branch:${event.branchId}`).emit("order.status_changed", event);
  }

  private extractToken(socket: Socket): string {
    // socket.io-client's `auth: { token }` option (the documented way to pass
    // credentials on connect) lands in handshake.auth, not headers or query.
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
