import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CouponsService } from "./coupons.service";
import { CouponResponseDto } from "./dto/coupon-response.dto";
import { CouponValidationResponseDto } from "./dto/coupon-validation-response.dto";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { ListCouponsQueryDto } from "./dto/list-coupons-query.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";
import { ValidateCouponDto } from "./dto/validate-coupon.dto";

@ApiTags("promotions")
@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post("coupons/validate")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Preview a coupon's discount for the current cart subtotal" })
  @ApiOkResponse({ type: CouponValidationResponseDto })
  async validate(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ValidateCouponDto,
  ): Promise<CouponValidationResponseDto> {
    const { coupon, discountAmount, freeDelivery } = await this.couponsService.validateForOrder(
      actor.id,
      dto.code,
      dto.subtotal,
    );
    return { code: coupon.code, discountType: coupon.discountType, discountAmount, freeDelivery };
  }

  @Get("admin/coupons")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List coupons (manager/admin)" })
  async list(@Query() query: ListCouponsQueryDto) {
    const page = await this.couponsService.list(query);
    return { ...page, items: page.items.map((c) => this.toResponse(c)) };
  }

  @Get("admin/coupons/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a coupon by id (manager/admin)" })
  @ApiOkResponse({ type: CouponResponseDto })
  async get(@Param("id") id: string): Promise<CouponResponseDto> {
    const coupon = await this.couponsService.findByIdOrThrow(id);
    return this.toResponse(coupon);
  }

  @Post("admin/coupons")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a coupon (manager/admin)" })
  @ApiOkResponse({ type: CouponResponseDto })
  async create(@Body() dto: CreateCouponDto): Promise<CouponResponseDto> {
    const created = await this.couponsService.create(dto);
    return this.toResponse(created);
  }

  @Patch("admin/coupons/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a coupon (manager/admin)" })
  @ApiOkResponse({ type: CouponResponseDto })
  async update(@Param("id") id: string, @Body() dto: UpdateCouponDto): Promise<CouponResponseDto> {
    const updated = await this.couponsService.update(id, dto);
    return this.toResponse(updated);
  }

  private toResponse(
    coupon: Awaited<ReturnType<CouponsService["findByIdOrThrow"]>>,
  ): CouponResponseDto {
    return {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      minOrderTotal: coupon.minOrderTotal,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      maxRedemptions: coupon.maxRedemptions,
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt,
    };
  }
}
