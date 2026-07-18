import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationChannel, NotificationStatus, OrderStatus } from "@prisma/client";
import {
  ORDER_EVENTS,
  type OrderCreatedEvent,
  type OrderPaidEvent,
  type OrderStatusChangedEvent,
} from "../../common/events/order-events";
import { PrismaService } from "../../database/prisma.service";
import { SMS_PROVIDER, type SmsProvider } from "../auth/sms/sms-provider.interface";
import { EMAIL_PROVIDER, type EmailProvider } from "./providers/email-provider.interface";
import { PUSH_PROVIDER, type PushProvider } from "./providers/push-provider.interface";

const STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: "Your order has been confirmed!",
  [OrderStatus.PREPARING]: "Your order is being prepared.",
  [OrderStatus.READY]: "Your order is ready!",
  [OrderStatus.OUT_FOR_DELIVERY]: "Your order is out for delivery.",
  [OrderStatus.DELIVERED]: "Your order has been delivered. Enjoy!",
  [OrderStatus.COMPLETED]: "Thanks for ordering from Fresh Cup!",
  [OrderStatus.CANCELLED]: "Your order has been cancelled.",
};

/**
 * Dispatches on domain events (see common/events/order-events.ts) across
 * SMS/email/push, and logs every attempt to `notification_logs` regardless
 * of outcome. Synchronous, in-process — see the durability note on
 * ORDER_EVENTS for why this isn't BullMQ-backed yet.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
  ) {}

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.notifyUser(
      event.userId,
      "order_created",
      "Order received! We'll confirm it once payment goes through.",
      { orderId: event.orderId },
    );
  }

  @OnEvent(ORDER_EVENTS.STATUS_CHANGED)
  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const message = STATUS_MESSAGES[event.toStatus];
    if (!message) {
      return;
    }
    await this.notifyUser(event.userId, "order_status_changed", message, {
      orderId: event.orderId,
      status: event.toStatus,
    });
  }

  @OnEvent(ORDER_EVENTS.PAID)
  async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    await this.notifyUser(event.userId, "order_paid", "Payment received — thank you!", {
      orderId: event.orderId,
    });
  }

  private async notifyUser(
    userId: string,
    type: string,
    message: string,
    data: Record<string, string>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return;
    }
    const payload = { message, ...data };

    if (user.phone) {
      await this.dispatch(userId, NotificationChannel.SMS, type, payload, () =>
        this.smsProvider.send(user.phone!, message),
      );
    }
    if (user.email) {
      await this.dispatch(userId, NotificationChannel.EMAIL, type, payload, () =>
        this.emailProvider.send(user.email!, "Fresh Cup", message),
      );
    }

    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    for (const token of tokens) {
      await this.dispatch(userId, NotificationChannel.PUSH, type, payload, () =>
        this.pushProvider.send(token.token, "Fresh Cup", message, data),
      );
    }
  }

  private async dispatch(
    userId: string,
    channel: NotificationChannel,
    type: string,
    payload: Record<string, string>,
    send: () => Promise<void>,
  ): Promise<void> {
    try {
      await send();
      await this.prisma.notificationLog.create({
        data: { userId, channel, type, payload, status: NotificationStatus.SENT },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send ${channel} notification (${type}) to user ${userId}: ${message}`,
      );
      await this.prisma.notificationLog.create({
        data: { userId, channel, type, payload, status: NotificationStatus.FAILED, error: message },
      });
    }
  }
}
