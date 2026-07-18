import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Address } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { AddressResponseDto } from "./dto/address-response.dto";
import type { CreateAddressDto } from "./dto/create-address.dto";
import type { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    if (dto.isDefault) {
      await this.clearExistingDefault(userId);
    }

    return this.prisma.address.create({
      data: { ...dto, userId },
    });
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto): Promise<Address> {
    await this.findOwnedOrThrow(userId, addressId);

    if (dto.isDefault) {
      await this.clearExistingDefault(userId);
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: dto,
    });
  }

  async remove(userId: string, addressId: string): Promise<void> {
    await this.findOwnedOrThrow(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  private async findOwnedOrThrow(userId: string, addressId: string): Promise<Address> {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) {
      throw new NotFoundException("Address not found");
    }
    if (address.userId !== userId) {
      throw new ForbiddenException("You do not have permission to access this address");
    }
    return address;
  }

  private clearExistingDefault(userId: string): Promise<unknown> {
    return this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  toResponse(address: Address): AddressResponseDto {
    return {
      id: address.id,
      label: address.label,
      freeText: address.freeText,
      lat: address.lat ? Number(address.lat) : null,
      lng: address.lng ? Number(address.lng) : null,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
    };
  }
}
