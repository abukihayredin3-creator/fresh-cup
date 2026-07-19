import { Injectable, NotFoundException } from "@nestjs/common";
import type { ApiKey } from "@prisma/client";
import { generateOpaqueToken, sha256 } from "../../../common/crypto/token.util";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { ApiKeyResponseDto, CreatedApiKeyResponseDto } from "./dto/api-key-response.dto";
import type { CreateApiKeyDto } from "./dto/create-api-key.dto";

const KEY_PREFIX_LENGTH = 8;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  }

  /** The raw key is returned once, at creation, and never again — only its hash is stored. */
  async create(actor: RequestUser, dto: CreateApiKeyDto): Promise<CreatedApiKeyResponseDto> {
    const rawKey = `fck_${generateOpaqueToken()}`;
    const created = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyHash: sha256(rawKey),
        keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
        createdByUserId: actor.id,
      },
    });
    return { ...this.toResponse(created), key: rawKey };
  }

  async revoke(id: string): Promise<void> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      throw new NotFoundException("API key not found");
    }
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  toResponse(key: ApiKey): ApiKeyResponseDto {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    };
  }
}
