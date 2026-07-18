import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  PaymentMethod,
  PaymentProvider as PaymentProviderEnum,
  PaymentStatus,
  Prisma,
  UserRole,
  type Payment,
} from "@prisma/client";
import { assertBranchAccess } from "../../common/access/branch-access.util";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import { ORDER_EVENTS, type OrderPaidEvent } from "../../common/events/order-events";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import { OrdersService } from "../ordering/orders/orders.service";
import { UsersService } from "../users/users.service";
import type { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import type { InitiatePaymentResponseDto, PaymentResponseDto } from "./dto/payment-response.dto";
import {
  PAYMENT_PROVIDER_CASH,
  PAYMENT_PROVIDER_CHAPA,
  type PaymentProvider,
} from "./providers/payment-provider.interface";

interface ChapaWebhookPayload {
  tx_ref?: string;
  status?: string;
  [key: string]: unknown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(PAYMENT_PROVIDER_CHAPA) private readonly chapaProvider: PaymentProvider,
    @Inject(PAYMENT_PROVIDER_CASH) private readonly cashProvider: PaymentProvider,
  ) {}

  async initiate(actor: RequestUser, dto: InitiatePaymentDto): Promise<InitiatePaymentResponseDto> {
    const order = await this.ordersService.getOrderSummary(dto.orderId);

    if (actor.role === UserRole.CUSTOMER) {
      if (order.userId !== actor.id) {
        throw new ForbiddenException("You do not have permission to pay for this order");
      }
    } else {
      assertBranchAccess(actor, order.branchId);
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new BadRequestException("This order is not awaiting payment");
    }

    const provider =
      dto.method === PaymentMethod.CASH ? PaymentProviderEnum.CASH : PaymentProviderEnum.CHAPA;
    const providerImpl =
      provider === PaymentProviderEnum.CASH ? this.cashProvider : this.chapaProvider;
    const user = await this.usersService.findByIdOrThrow(order.userId);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider,
        method: dto.method,
        amount: order.total,
        currency: order.currency,
        status: PaymentStatus.INITIATED,
      },
    });

    const result = await providerImpl.initiate({
      paymentId: payment.id,
      orderId: order.id,
      amount: order.total,
      currency: order.currency,
      method: dto.method,
      customerEmail: user.email,
      customerName: user.fullName,
      customerPhone: user.phone,
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerReference: result.providerReference },
    });

    if (provider === PaymentProviderEnum.CASH) {
      // Cash orders let the kitchen start immediately; settlement (and loyalty
      // accrual, which is tied to a SUCCEEDED payment) is confirmed later by
      // staff via POST /payments/:id/confirm-cash.
      await this.ordersService.confirmAfterPayment(order.id);
    }

    return { ...this.toResponse(updated), checkoutUrl: result.checkoutUrl };
  }

  async confirmCash(actor: RequestUser, paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.findByIdOrThrow(paymentId);
    if (payment.provider !== PaymentProviderEnum.CASH) {
      throw new BadRequestException("Only cash payments can be confirmed this way");
    }

    const order = await this.ordersService.getOrderSummary(payment.orderId);
    assertBranchAccess(actor, order.branchId);

    if (payment.status !== PaymentStatus.INITIATED) {
      return this.toResponse(payment);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCEEDED, completedAt: new Date() },
    });

    await this.eventEmitter.emitAsync(ORDER_EVENTS.PAID, {
      orderId: order.id,
      branchId: order.branchId,
      userId: order.userId,
      total: order.total,
      currency: order.currency,
    } satisfies OrderPaidEvent);

    return this.toResponse(updated);
  }

  async refund(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.findByIdOrThrow(paymentId);
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException("Only a succeeded payment can be refunded");
    }

    const providerImpl =
      payment.provider === PaymentProviderEnum.CASH ? this.cashProvider : this.chapaProvider;
    await providerImpl.refund(payment.providerReference ?? payment.id, payment.amount);

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED, completedAt: new Date() },
    });
    return this.toResponse(updated);
  }

  async handleChapaWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    payload: unknown,
  ): Promise<void> {
    this.verifyChapaSignature(rawBody, signature);

    const body = payload as ChapaWebhookPayload;
    const txRef = body.tx_ref;
    if (!txRef) {
      throw new BadRequestException("Missing tx_ref in webhook payload");
    }

    const payment = await this.prisma.payment.findUnique({ where: { providerReference: txRef } });
    if (!payment) {
      this.logger.warn(`Chapa webhook for unknown tx_ref ${txRef}`);
      return;
    }
    if (payment.status !== PaymentStatus.INITIATED) {
      return; // already processed — idempotent against webhook retries
    }

    const succeeded = body.status === "success";
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: succeeded ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
        completedAt: new Date(),
        rawWebhookPayload: body as unknown as Prisma.InputJsonValue,
      },
    });

    if (succeeded) {
      await this.ordersService.confirmAfterPayment(updated.orderId);
      const order = await this.ordersService.getOrderSummary(updated.orderId);
      await this.eventEmitter.emitAsync(ORDER_EVENTS.PAID, {
        orderId: order.id,
        branchId: order.branchId,
        userId: order.userId,
        total: order.total,
        currency: order.currency,
      } satisfies OrderPaidEvent);
    }
  }

  private verifyChapaSignature(rawBody: Buffer, signature: string | undefined): void {
    const secret = this.config.get("CHAPA_WEBHOOK_SECRET", { infer: true });
    if (!secret) {
      this.logger.warn(
        "CHAPA_WEBHOOK_SECRET not configured — accepting webhook unverified (sandbox mode)",
      );
      return;
    }
    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature");
    }

    const expected = Buffer.from(
      createHmac("sha256", secret).update(rawBody).digest("hex"),
      "utf8",
    );
    const provided = Buffer.from(signature, "utf8");
    const valid = expected.length === provided.length && timingSafeEqual(expected, provided);
    if (!valid) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  private async findByIdOrThrow(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    return payment;
  }

  private toResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      method: payment.method,
      providerReference: payment.providerReference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      initiatedAt: payment.initiatedAt,
      completedAt: payment.completedAt,
    };
  }
}
