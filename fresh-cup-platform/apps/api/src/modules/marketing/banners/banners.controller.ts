import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { BannersService } from "./banners.service";
import { BannerResponseDto } from "./dto/banner-response.dto";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { ListBannersQueryDto } from "./dto/list-banners-query.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";

@ApiTags("marketing")
@Controller()
@Auditable("Banner")
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get("banners/active")
  @ApiOperation({ summary: "Currently-active banners for a branch (public)" })
  @ApiOkResponse({ type: BannerResponseDto, isArray: true })
  async active(@Query("branchId") branchId?: string): Promise<BannerResponseDto[]> {
    const banners = await this.bannersService.active(branchId);
    return banners.map((b) => this.bannersService.toResponse(b));
  }

  @Get("admin/banners")
  @Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List banners (marketing/manager/admin)" })
  async list(@Query() query: ListBannersQueryDto) {
    const page = await this.bannersService.list(query);
    return { ...page, items: page.items.map((b) => this.bannersService.toResponse(b)) };
  }

  @Get("admin/banners/:id")
  @Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a banner by id (marketing/manager/admin)" })
  @ApiOkResponse({ type: BannerResponseDto })
  async get(@Param("id") id: string): Promise<BannerResponseDto> {
    const banner = await this.bannersService.findByIdOrThrow(id);
    return this.bannersService.toResponse(banner);
  }

  @Post("admin/banners")
  @Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a banner (marketing/manager/admin)" })
  @ApiOkResponse({ type: BannerResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateBannerDto,
  ): Promise<BannerResponseDto> {
    const created = await this.bannersService.create(actor, dto);
    return this.bannersService.toResponse(created);
  }

  @Patch("admin/banners/:id")
  @Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a banner (marketing/manager/admin)" })
  @ApiOkResponse({ type: BannerResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateBannerDto,
  ): Promise<BannerResponseDto> {
    const updated = await this.bannersService.update(actor, id, dto);
    return this.bannersService.toResponse(updated);
  }

  @Delete("admin/banners/:id")
  @Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a banner (marketing/manager/admin)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.bannersService.remove(actor, id);
  }
}
