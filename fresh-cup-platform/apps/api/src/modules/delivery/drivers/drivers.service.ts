import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole, type DriverProfile, type User } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { hashPassword } from "../../../common/crypto/password.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateDriverDto } from "./dto/create-driver.dto";
import type { DriverResponseDto } from "./dto/driver-response.dto";
import type { ListDriversQueryDto } from "./dto/list-drivers-query.dto";
import type { UpdateDriverDto } from "./dto/update-driver.dto";

export type DriverWithProfile = User & { driverProfile: DriverProfile | null };

const WITH_DRIVER_PROFILE = { driverProfile: true } as const;

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: RequestUser, query: ListDriversQueryDto) {
    const where: Prisma.UserWhereInput = { role: UserRole.DRIVER };
    if (actor.role === UserRole.MANAGER) {
      where.branchId = actor.branchId ?? "__no_branch__";
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }

    return paginate<DriverWithProfile>(
      (page) =>
        this.prisma.user.findMany({
          where,
          include: WITH_DRIVER_PROFILE,
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<DriverWithProfile> {
    const driver = await this.prisma.user.findUnique({
      where: { id },
      include: WITH_DRIVER_PROFILE,
    });
    if (!driver || driver.role !== UserRole.DRIVER) {
      throw new NotFoundException("Driver not found");
    }
    return driver;
  }

  async create(actor: RequestUser, dto: CreateDriverDto): Promise<DriverWithProfile> {
    assertBranchAccess(actor, dto.branchId);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`A user with email ${dto.email} already exists`);
    }

    const passwordHash = await hashPassword(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: UserRole.DRIVER,
        branchId: dto.branchId,
        driverProfile: {
          create: { vehicleType: dto.vehicleType, licensePlate: dto.licensePlate },
        },
      },
      include: WITH_DRIVER_PROFILE,
    });
  }

  async update(actor: RequestUser, id: string, dto: UpdateDriverDto): Promise<DriverWithProfile> {
    const driver = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, driver.branchId ?? "__no_branch__");

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        isActive: dto.isActive,
        driverProfile: {
          update: { vehicleType: dto.vehicleType, licensePlate: dto.licensePlate },
        },
      },
      include: WITH_DRIVER_PROFILE,
    });
  }

  /** Used by the driver-facing endpoints in the delivery module (self-service availability/location). */
  async setAvailability(driverId: string, isOnline: boolean): Promise<DriverProfile> {
    await this.assertHasDriverProfile(driverId);
    return this.prisma.driverProfile.update({ where: { userId: driverId }, data: { isOnline } });
  }

  async recordLocation(driverId: string, lat: number, lng: number): Promise<DriverProfile> {
    await this.assertHasDriverProfile(driverId);
    return this.prisma.driverProfile.update({
      where: { userId: driverId },
      data: { currentLat: lat, currentLng: lng, lastPingAt: new Date() },
    });
  }

  private async assertHasDriverProfile(driverId: string): Promise<void> {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (!profile) {
      throw new NotFoundException("Driver profile not found");
    }
  }

  toResponse(driver: DriverWithProfile): DriverResponseDto {
    return {
      id: driver.id,
      email: driver.email,
      fullName: driver.fullName,
      branchId: driver.branchId,
      isActive: driver.isActive,
      vehicleType: driver.driverProfile?.vehicleType ?? "",
      licensePlate: driver.driverProfile?.licensePlate ?? null,
      isOnline: driver.driverProfile?.isOnline ?? false,
      currentLat: driver.driverProfile?.currentLat ? Number(driver.driverProfile.currentLat) : null,
      currentLng: driver.driverProfile?.currentLng ? Number(driver.driverProfile.currentLng) : null,
      lastPingAt: driver.driverProfile?.lastPingAt ?? null,
    };
  }
}
