import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ReferralCode, ReferralRedemption } from "@prisma/client";
import { generateAlphanumericCode } from "../../../common/crypto/token.util";
import { paginate } from "../../../common/pagination/paginate";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateReferralCodeDto } from "./dto/create-referral-code.dto";
import type { ListReferralCodesQueryDto } from "./dto/list-referral-codes-query.dto";
import type { ReferralCodeResponseDto } from "./dto/referral-code-response.dto";
import type { ReferralRedemptionResponseDto } from "./dto/referral-redemption-response.dto";
import type { UpdateReferralCodeDto } from "./dto/update-referral-code.dto";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListReferralCodesQueryDto) {
    return paginate<ReferralCode>(
      (page) =>
        this.prisma.referralCode.findMany({
          where: { userId: query.userId },
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<ReferralCode> {
    const code = await this.prisma.referralCode.findUnique({ where: { id } });
    if (!code) {
      throw new NotFoundException("Referral code not found");
    }
    return code;
  }

  async create(dto: CreateReferralCodeDto): Promise<ReferralCode> {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId: dto.userId } });
    if (existing) {
      throw new BadRequestException("This user already has a referral code");
    }

    let code = generateAlphanumericCode(8);
    while (await this.prisma.referralCode.findUnique({ where: { code } })) {
      code = generateAlphanumericCode(8);
    }
    return this.prisma.referralCode.create({
      data: { userId: dto.userId, code, rewardAmount: dto.rewardAmount },
    });
  }

  async update(id: string, dto: UpdateReferralCodeDto): Promise<ReferralCode> {
    await this.findByIdOrThrow(id);
    return this.prisma.referralCode.update({ where: { id }, data: dto });
  }

  async redemptions(id: string): Promise<ReferralRedemption[]> {
    await this.findByIdOrThrow(id);
    return this.prisma.referralRedemption.findMany({
      where: { referralCodeId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  toResponse(code: ReferralCode): ReferralCodeResponseDto {
    return {
      id: code.id,
      userId: code.userId,
      code: code.code,
      rewardAmount: code.rewardAmount,
      usesCount: code.usesCount,
      isActive: code.isActive,
      createdAt: code.createdAt,
    };
  }

  redemptionToResponse(redemption: ReferralRedemption): ReferralRedemptionResponseDto {
    return {
      id: redemption.id,
      referralCodeId: redemption.referralCodeId,
      referredUserId: redemption.referredUserId,
      orderId: redemption.orderId,
      createdAt: redemption.createdAt,
    };
  }
}
