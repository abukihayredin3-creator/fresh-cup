import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { KitchenQueueQueryDto } from "./dto/kitchen-queue-query.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("orders")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Dedupes retried checkout requests",
  })
  @ApiOperation({
    summary: "Checkout — creates an order from the caller's cart for the given branch",
  })
  @ApiOkResponse({ type: OrderResponseDto })
  checkout(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<OrderResponseDto> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException("Idempotency-Key header is required");
    }
    return this.ordersService.checkout(actor, dto, idempotencyKey.trim());
  }

  @Get("orders")
  @ApiOperation({ summary: "List orders — own history for customers, branch-scoped for staff+" })
  list(@CurrentUser() actor: RequestUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(actor, query);
  }

  @Get("orders/:id")
  @ApiOperation({ summary: "Get an order — owner or staff of its branch only" })
  @ApiOkResponse({ type: OrderResponseDto })
  getOne(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<OrderResponseDto> {
    return this.ordersService.getOne(actor, id);
  }

  @Get("orders/:id/timeline")
  @ApiOperation({ summary: "Get an order's status history — owner or staff of its branch only" })
  getTimeline(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    return this.ordersService.getTimeline(actor, id);
  }

  @Patch("orders/:id/status")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Transition an order's status (staff+, enforces the valid-transition graph)",
  })
  @ApiOkResponse({ type: OrderResponseDto })
  updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateStatus(actor, id, dto);
  }

  @Post("orders/:id/cancel")
  @ApiOperation({
    summary:
      "Cancel an order (customer while pending_payment/confirmed, or staff of its branch anytime)",
  })
  @ApiOkResponse({ type: OrderResponseDto })
  cancel(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancel(actor, id, dto);
  }

  @Get("admin/orders/kitchen-queue")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Confirmed/preparing orders for a branch, oldest first (staff+)" })
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  kitchenQueue(
    @CurrentUser() actor: RequestUser,
    @Query() query: KitchenQueueQueryDto,
  ): Promise<OrderResponseDto[]> {
    return this.ordersService.kitchenQueue(actor, query.branchId);
  }
}
