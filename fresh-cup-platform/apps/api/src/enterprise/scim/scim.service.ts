import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ScimToken, User } from "@prisma/client";
import { generateOpaqueToken, sha256 } from "../../common/crypto/token.util";
import { PrismaService } from "../../database/prisma.service";
import { EnterpriseAuditService } from "../audit/enterprise-audit.service";
import type { CreateScimTokenDto } from "./dto/create-scim-token.dto";
import type { ScimCreateUserDto } from "./dto/scim-create-user.dto";
import type { ScimListResponse, ScimPatchOperation, ScimUserResource } from "./scim-user.types";

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

/**
 * A functional subset of SCIM 2.0 (RFC 7643/7644) — enough for an IdP's
 * automated provisioning connector to create, look up, deactivate, and
 * (soft-)delete users. `PATCH` only understands a `replace` operation on
 * the `active` path (the overwhelmingly common real-world SCIM operation
 * — offboarding deactivation), not the full PatchOp grammar; unsupported
 * operations are rejected rather than silently ignored.
 */
@Injectable()
export class ScimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: EnterpriseAuditService,
  ) {}

  async createToken(
    organizationId: string,
    dto: CreateScimTokenDto,
  ): Promise<{ id: string; name: string; token: string }> {
    const rawToken = generateOpaqueToken();
    const token = await this.prisma.scimToken.create({
      data: { organizationId, name: dto.name, tokenHash: sha256(rawToken) },
    });
    await this.auditService.record(organizationId, "SCIM_TOKEN_CREATED", { name: dto.name });
    return { id: token.id, name: token.name, token: rawToken };
  }

  listTokens(organizationId: string): Promise<ScimToken[]> {
    return this.prisma.scimToken.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeToken(organizationId: string, tokenId: string): Promise<void> {
    const token = await this.prisma.scimToken.findUnique({ where: { id: tokenId } });
    if (!token || token.organizationId !== organizationId) {
      throw new NotFoundException("SCIM token not found");
    }
    await this.prisma.scimToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
    await this.auditService.record(organizationId, "SCIM_TOKEN_REVOKED", { tokenId });
  }

  async listUsers(organizationId: string, filter?: string): Promise<ScimListResponse> {
    const userNameFilter = this.parseUserNameFilter(filter);
    const users = await this.prisma.user.findMany({
      where: {
        branch: { organizationId },
        ...(userNameFilter ? { email: userNameFilter } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: users.length,
      itemsPerPage: users.length,
      startIndex: 1,
      Resources: users.map((u) => this.toScimResource(u)),
    };
  }

  async getUser(organizationId: string, userId: string): Promise<ScimUserResource> {
    const user = await this.findUserOrThrow(organizationId, userId);
    return this.toScimResource(user);
  }

  async createUser(organizationId: string, dto: ScimCreateUserDto): Promise<ScimUserResource> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.userName } });
    if (existing) {
      throw new ConflictException(`User '${dto.userName}' already exists`);
    }

    const defaultBranch = await this.prisma.branch.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    if (!defaultBranch) {
      throw new ConflictException("Organization has no branch to provision SCIM users into");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.userName,
        fullName: dto.displayName ?? dto.userName,
        role: "STAFF",
        branchId: defaultBranch.id,
        isActive: dto.active ?? true,
      },
    });
    await this.auditService.record(organizationId, "SCIM_USER_PROVISIONED", {
      email: dto.userName,
    });
    return this.toScimResource(user);
  }

  async replaceUser(
    organizationId: string,
    userId: string,
    dto: ScimCreateUserDto,
  ): Promise<ScimUserResource> {
    await this.findUserOrThrow(organizationId, userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.displayName ?? dto.userName,
        isActive: dto.active ?? true,
      },
    });
    return this.toScimResource(user);
  }

  async patchUser(
    organizationId: string,
    userId: string,
    operations: ScimPatchOperation[],
  ): Promise<ScimUserResource> {
    await this.findUserOrThrow(organizationId, userId);

    let isActive: boolean | undefined;
    for (const op of operations) {
      if (op.op === "replace" && op.path === "active") {
        isActive = Boolean(op.value);
      } else {
        throw new ForbiddenException(
          `Unsupported SCIM PatchOp: ${op.op} ${op.path ?? ""} — only "replace active" is implemented`,
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: isActive === undefined ? {} : { isActive },
    });
    if (isActive === false) {
      await this.auditService.record(organizationId, "SCIM_USER_DEACTIVATED", { userId });
    }
    return this.toScimResource(user);
  }

  async deleteUser(organizationId: string, userId: string): Promise<void> {
    await this.findUserOrThrow(organizationId, userId);
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await this.auditService.record(organizationId, "SCIM_USER_DEACTIVATED", {
      userId,
      via: "DELETE",
    });
  }

  private async findUserOrThrow(organizationId: string, userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.branchId) {
      throw new NotFoundException("User not found");
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: user.branchId } });
    if (branch?.organizationId !== organizationId) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private toScimResource(user: User): ScimUserResource {
    return {
      schemas: [SCIM_USER_SCHEMA],
      id: user.id,
      userName: user.email ?? "",
      name: { formatted: user.fullName },
      emails: user.email ? [{ value: user.email, primary: true }] : [],
      active: user.isActive,
    };
  }

  /** Understands only `userName eq "value"` — the one filter every IdP's connector actually sends. */
  private parseUserNameFilter(filter?: string): string | undefined {
    if (!filter) return undefined;
    const match = /userName\s+eq\s+"([^"]+)"/.exec(filter);
    return match?.[1];
  }
}
