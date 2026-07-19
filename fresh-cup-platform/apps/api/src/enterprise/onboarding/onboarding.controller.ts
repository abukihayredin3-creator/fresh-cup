import { Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { OnboardTenantDto } from "./dto/onboard-tenant.dto";
import { OnboardTenantResponseDto } from "./dto/onboard-tenant-response.dto";
import { OnboardingService } from "./onboarding.service";

@ApiTags("enterprise-onboarding")
@Controller("enterprise/onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: "Onboard a brand-new tenant: organization + first branch + owner admin",
  })
  @ApiOkResponse({ type: OnboardTenantResponseDto })
  onboard(@Body() dto: OnboardTenantDto): Promise<OnboardTenantResponseDto> {
    return this.onboardingService.onboard(dto);
  }
}
