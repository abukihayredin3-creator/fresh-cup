import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CampaignsService } from "./campaigns.service";
import { CampaignResponseDto } from "./dto/campaign-response.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { ListCampaignsQueryDto } from "./dto/list-campaigns-query.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

@ApiTags("marketing")
@Controller("admin/campaigns")
@Roles(UserRole.MARKETING_STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("Campaign")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: "List marketing campaigns (marketing/manager/admin)" })
  async list(@Query() query: ListCampaignsQueryDto) {
    const page = await this.campaignsService.list(query);
    return { ...page, items: page.items.map((c) => this.campaignsService.toResponse(c)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a campaign by id (marketing/manager/admin)" })
  @ApiOkResponse({ type: CampaignResponseDto })
  async get(@Param("id") id: string): Promise<CampaignResponseDto> {
    const campaign = await this.campaignsService.findByIdOrThrow(id);
    return this.campaignsService.toResponse(campaign);
  }

  @Post()
  @ApiOperation({ summary: "Create a draft (or scheduled) campaign (marketing/manager/admin)" })
  @ApiOkResponse({ type: CampaignResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCampaignDto,
  ): Promise<CampaignResponseDto> {
    const created = await this.campaignsService.create(actor, dto);
    return this.campaignsService.toResponse(created);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a draft or scheduled campaign (marketing/manager/admin)" })
  @ApiOkResponse({ type: CampaignResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    const updated = await this.campaignsService.update(id, dto);
    return this.campaignsService.toResponse(updated);
  }

  @Post(":id/send")
  @ApiOperation({
    summary: "Dispatch a campaign to its target segment now (marketing/manager/admin)",
  })
  @ApiOkResponse({ type: CampaignResponseDto })
  async send(@Param("id") id: string): Promise<CampaignResponseDto> {
    const sent = await this.campaignsService.send(id);
    return this.campaignsService.toResponse(sent);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a draft or scheduled campaign (marketing/manager/admin)" })
  @ApiOkResponse({ type: CampaignResponseDto })
  async cancel(@Param("id") id: string): Promise<CampaignResponseDto> {
    const cancelled = await this.campaignsService.cancel(id);
    return this.campaignsService.toResponse(cancelled);
  }
}
