import { Injectable } from "@nestjs/common";
import type { PermissionKey, StaffPermission } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { PermissionResponseDto } from "./dto/permission-response.dto";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string): Promise<StaffPermission[]> {
    return this.prisma.staffPermission.findMany({ where: { userId } });
  }

  grant(actor: RequestUser, userId: string, permission: PermissionKey): Promise<StaffPermission> {
    return this.prisma.staffPermission.upsert({
      where: { userId_permission: { userId, permission } },
      create: { userId, permission, grantedByUserId: actor.id },
      update: { grantedByUserId: actor.id },
    });
  }

  async revoke(userId: string, permission: PermissionKey): Promise<void> {
    await this.prisma.staffPermission.deleteMany({ where: { userId, permission } });
  }

  toResponse(permission: StaffPermission): PermissionResponseDto {
    return {
      id: permission.id,
      userId: permission.userId,
      permission: permission.permission,
      grantedByUserId: permission.grantedByUserId,
      createdAt: permission.createdAt,
    };
  }
}
