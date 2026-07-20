import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { TrustedDevice } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { DeviceTrustService } from "./device-trust.service";
import { TrustDeviceDto } from "./dto/trust-device.dto";

@ApiTags("enterprise-device-trust")
@ApiBearerAuth()
@Controller("enterprise/device-trust")
export class DeviceTrustController {
  constructor(private readonly deviceTrustService: DeviceTrustService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's trusted devices" })
  @ApiOkResponse({ isArray: true })
  list(@CurrentUser() actor: RequestUser): Promise<TrustedDevice[]> {
    return this.deviceTrustService.listDevices(actor.id);
  }

  @Post()
  @ApiOperation({ summary: "Trust this device (remember for N days)" })
  trust(@CurrentUser() actor: RequestUser, @Body() dto: TrustDeviceDto): Promise<TrustedDevice> {
    return this.deviceTrustService.trustDevice(actor.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Revoke a trusted device" })
  revoke(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    return this.deviceTrustService.revokeDevice(actor.id, id);
  }
}
