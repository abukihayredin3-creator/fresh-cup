import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole, type Prisma, type User } from "@prisma/client";
import { hashPassword } from "../../common/crypto/password.util";
import { paginate } from "../../common/pagination/paginate";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import type { CreateStaffUserDto } from "./dto/create-staff-user.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { AdminUserResponseDto, UserResponseDto } from "./dto/user-response.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  /** Finds an existing customer by phone, or creates one — the standard OTP-login upsert. */
  async findOrCreateCustomerByPhone(phone: string): Promise<User> {
    const existing = await this.findByPhone(phone);
    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        phone,
        fullName: "Fresh Cup Customer",
        role: UserRole.CUSTOMER,
      },
    });
  }

  async createStaffUser(dto: CreateStaffUserDto): Promise<User> {
    const passwordHash = await hashPassword(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        branchId: dto.branchId,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  async listUsers(actor: RequestUser, query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    // Managers only ever see their own branch, regardless of what they ask for.
    if (actor.role === UserRole.MANAGER) {
      where.branchId = actor.branchId ?? "__no_branch__";
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }

    return paginate<User>(
      (page) =>
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async adminUpdateUser(
    actor: RequestUser,
    targetId: string,
    dto: AdminUpdateUserDto,
  ): Promise<User> {
    const target = await this.findByIdOrThrow(targetId);
    this.assertCanManage(actor, target);

    if (dto.role && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only an admin can change a user's role");
    }
    if ((dto.isOwner !== undefined || dto.salary !== undefined) && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only an admin can change owner status or salary");
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: dto,
    });
  }

  /** Managers are confined to their own branch; admins can manage anyone. */
  private assertCanManage(actor: RequestUser, target: User): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (actor.role === UserRole.MANAGER && target.branchId === actor.branchId) {
      return;
    }
    throw new ForbiddenException("You do not have permission to manage this user");
  }

  static assertUniqueEmailAvailable(existing: User | null, email: string): void {
    if (existing) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }
  }

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      locale: user.locale,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  toAdminResponse(user: User): AdminUserResponseDto {
    return {
      ...this.toResponse(user),
      isOwner: user.isOwner,
      departmentId: user.departmentId,
      salary: user.salary ? Number(user.salary) : null,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
