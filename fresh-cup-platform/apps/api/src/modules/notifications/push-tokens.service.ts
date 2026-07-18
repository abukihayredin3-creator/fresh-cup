import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { RegisterPushTokenDto } from "./dto/register-push-token.dto";

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterPushTokenDto): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform },
    });
  }

  async unregister(userId: string, tokenId: string): Promise<void> {
    const token = await this.prisma.pushToken.findUnique({ where: { id: tokenId } });
    if (!token || token.userId !== userId) {
      throw new NotFoundException("Push token not found");
    }
    await this.prisma.pushToken.delete({ where: { id: tokenId } });
  }
}
