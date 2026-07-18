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
  DELIVERY_EVENTS,
  type DeliveryAssignedEvent,
  type DeliveryLocationUpdatedEvent,
  type DeliveryStatusChangedEvent,
} from "../common/events/delivery-events";
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
 * /ws/delivery — GPS tracking + status updates for a single delivery
 * (`delivery:{id}` room, joined by the customer who placed the order, staff
 * of the owning branch, and the assigned driver) and the branch-wide
 * dispatch feed (`branch:{id}` room, staff+ only). Mirrors OrdersGateway's
 * auth and room-scoping pattern.
 */
@WebSocketGateway({ namespace: "/ws/delivery", cors: { origin: true, credentials: true } })
export class DeliveryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(DeliveryGateway.name);

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

  @SubscribeMessage("subscribeDelivery")
  async subscribeDelivery(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { deliveryId: string },
  ): Promise<SubscribeAck> {
    const user = socket.data.user;
    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: data.deliveryId },
      include: { order: { select: { userId: true } } },
    });
    if (!delivery) {
      return { ok: false, error: "not_found" };
    }

    const canView =
      delivery.order.userId === user.id ||
      delivery.driverId === user.id ||
      user.role === UserRole.ADMIN ||
      ((user.role === UserRole.STAFF || user.role === UserRole.MANAGER) &&
        user.branchId === delivery.branchId);
    if (!canView) {
      return { ok: false, error: "forbidden" };
    }

    await socket.join(`delivery:${delivery.id}`);
    return { ok: true };
  }

  @OnEvent(DELIVERY_EVENTS.ASSIGNED)
  handleAssigned(event: DeliveryAssignedEvent): void {
    this.server.to(`delivery:${event.deliveryId}`).emit("delivery.assigned", event);
    this.server.to(`branch:${event.branchId}`).emit("delivery.assigned", event);
  }

  @OnEvent(DELIVERY_EVENTS.STATUS_CHANGED)
  handleStatusChanged(event: DeliveryStatusChangedEvent): void {
    this.server.to(`delivery:${event.deliveryId}`).emit("delivery.status_changed", event);
    this.server.to(`branch:${event.branchId}`).emit("delivery.status_changed", event);
  }

  @OnEvent(DELIVERY_EVENTS.LOCATION_UPDATED)
  handleLocationUpdated(event: DeliveryLocationUpdatedEvent): void {
    if (event.deliveryId) {
      this.server.to(`delivery:${event.deliveryId}`).emit("delivery.location_updated", event);
    }
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
