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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AddressesService } from "./addresses.service";
import { AddressResponseDto } from "./dto/address-response.dto";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";

@ApiTags("addresses")
@ApiBearerAuth()
@Controller("addresses")
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's addresses" })
  @ApiOkResponse({ type: AddressResponseDto, isArray: true })
  async list(@CurrentUser() user: RequestUser): Promise<AddressResponseDto[]> {
    const addresses = await this.addressesService.list(user.id);
    return addresses.map((a) => this.addressesService.toResponse(a));
  }

  @Post()
  @ApiOperation({ summary: "Add an address" })
  @ApiOkResponse({ type: AddressResponseDto })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const created = await this.addressesService.create(user.id, dto);
    return this.addressesService.toResponse(created);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an address" })
  @ApiOkResponse({ type: AddressResponseDto })
  async update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    const updated = await this.addressesService.update(user.id, id, dto);
    return this.addressesService.toResponse(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an address" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.addressesService.remove(user.id, id);
  }
}
