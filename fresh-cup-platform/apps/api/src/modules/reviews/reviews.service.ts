import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type ProductReview } from "@prisma/client";
import { paginate } from "../../common/pagination/paginate";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { CreateReviewDto } from "./dto/create-review.dto";
import type { ListReviewsQueryDto } from "./dto/list-reviews-query.dto";
import type { ReviewResponseDto } from "./dto/review-response.dto";

const WITH_USER = { user: { select: { fullName: true } } } as const;
type ReviewDetail = Prisma.ProductReviewGetPayload<{ include: typeof WITH_USER }>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForItem(menuItemId: string, query: ListReviewsQueryDto) {
    return paginate<ReviewDetail>(
      (page) =>
        this.prisma.productReview.findMany({
          where: { menuItemId },
          orderBy: { createdAt: "desc" },
          include: WITH_USER,
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  listAdmin(query: ListReviewsQueryDto) {
    return paginate<ReviewDetail>(
      (page) =>
        this.prisma.productReview.findMany({
          where: { menuItemId: query.menuItemId, userId: query.userId, rating: query.rating },
          orderBy: { createdAt: "desc" },
          include: WITH_USER,
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async create(
    actor: RequestUser,
    menuItemId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDetail> {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { items: { select: { menuItemId: true } } },
      });
      if (!order || order.userId !== actor.id) {
        throw new BadRequestException("Order not found for this account");
      }
      if (!order.items.some((item) => item.menuItemId === menuItemId)) {
        throw new BadRequestException("This order did not include that menu item");
      }
    }

    try {
      return await this.prisma.productReview.create({
        data: {
          menuItemId,
          userId: actor.id,
          orderId: dto.orderId,
          rating: dto.rating,
          comment: dto.comment,
        },
        include: WITH_USER,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("You have already reviewed this item");
      }
      throw error;
    }
  }

  async findByIdOrThrow(id: string): Promise<ProductReview> {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException("Review not found");
    }
    return review;
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.productReview.delete({ where: { id } });
  }

  toResponse(review: ReviewDetail): ReviewResponseDto {
    return {
      id: review.id,
      menuItemId: review.menuItemId,
      userId: review.userId,
      userName: review.user.fullName,
      orderId: review.orderId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    };
  }
}
