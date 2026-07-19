import { Injectable, NotFoundException } from "@nestjs/common";
import type { Banner, Prisma } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { BannerResponseDto } from "./dto/banner-response.dto";
import type { CreateBannerDto } from "./dto/create-banner.dto";
import type { ListBannersQueryDto } from "./dto/list-banners-query.dto";
import type { UpdateBannerDto } from "./dto/update-banner.dto";

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListBannersQueryDto) {
    return paginate<Banner>(
      (page) =>
        this.prisma.banner.findMany({
          where: { branchId: query.branchId },
          orderBy: { sortOrder: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  /** Currently-active banners for a branch (and chain-wide ones), for public display. */
  active(branchId?: string): Promise<Banner[]> {
    const now = new Date();
    const where: Prisma.BannerWhereInput = {
      isActive: true,
      OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
    return this.prisma.banner.findMany({ where, orderBy: { sortOrder: "asc" } });
  }

  async findByIdOrThrow(id: string): Promise<Banner> {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException("Banner not found");
    }
    return banner;
  }

  create(actor: RequestUser, dto: CreateBannerDto): Promise<Banner> {
    if (dto.branchId) {
      assertBranchAccess(actor, dto.branchId);
    }
    return this.prisma.banner.create({ data: dto });
  }

  async update(actor: RequestUser, id: string, dto: UpdateBannerDto): Promise<Banner> {
    const banner = await this.findByIdOrThrow(id);
    if (banner.branchId) {
      assertBranchAccess(actor, banner.branchId);
    }
    return this.prisma.banner.update({ where: { id }, data: dto });
  }

  async remove(actor: RequestUser, id: string): Promise<void> {
    const banner = await this.findByIdOrThrow(id);
    if (banner.branchId) {
      assertBranchAccess(actor, banner.branchId);
    }
    await this.prisma.banner.delete({ where: { id } });
  }

  toResponse(banner: Banner): BannerResponseDto {
    return {
      id: banner.id,
      branchId: banner.branchId,
      title: banner.title,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      startsAt: banner.startsAt,
      endsAt: banner.endsAt,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
    };
  }
}
