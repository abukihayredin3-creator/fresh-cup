import type { RawBodyRequest } from "@nestjs/common";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { Auditable } from "../../common/audit/auditable.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { InitiatePaymentResponseDto, PaymentResponseDto } from "./dto/payment-response.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("initiate")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Start a payment for an order (owner, or staff of its branch)" })
  @ApiOkResponse({ type: InitiatePaymentResponseDto })
  initiate(
    @CurrentUser() actor: RequestUser,
    @Body() dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResponseDto> {
    return this.paymentsService.initiate(actor, dto);
  }

  @Public()
  @Post("webhooks/chapa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Chapa payment status callback (signature-verified)" })
  async chapaWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    if (!req.rawBody) {
      throw new BadRequestException("Missing request body");
    }
    const signature = req.headers["chapa-signature"] ?? req.headers["x-chapa-signature"];
    await this.paymentsService.handleChapaWebhook(
      req.rawBody,
      Array.isArray(signature) ? signature[0] : signature,
      req.body,
    );
    return { received: true };
  }

  @Post(":id/confirm-cash")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @Auditable("Payment")
  @ApiOperation({ summary: "Confirm a cash payment was physically received (staff+)" })
  @ApiOkResponse({ type: PaymentResponseDto })
  confirmCash(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.confirmCash(actor, id);
  }

  @Post(":id/refund")
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Auditable("Payment")
  @ApiOperation({ summary: "Refund a succeeded payment (admin only)" })
  @ApiOkResponse({ type: PaymentResponseDto })
  refund(@Param("id") id: string): Promise<PaymentResponseDto> {
    return this.paymentsService.refund(id);
  }
}
