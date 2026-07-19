import { Injectable } from "@nestjs/common";
import type { PerformanceNote } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreatePerformanceNoteDto } from "./dto/create-performance-note.dto";
import type { PerformanceNoteResponseDto } from "./dto/performance-note-response.dto";

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string): Promise<PerformanceNote[]> {
    return this.prisma.performanceNote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  create(
    actor: RequestUser,
    userId: string,
    dto: CreatePerformanceNoteDto,
  ): Promise<PerformanceNote> {
    return this.prisma.performanceNote.create({
      data: { userId, authorUserId: actor.id, rating: dto.rating, note: dto.note },
    });
  }

  toResponse(note: PerformanceNote): PerformanceNoteResponseDto {
    return {
      id: note.id,
      userId: note.userId,
      authorUserId: note.authorUserId,
      rating: note.rating,
      note: note.note,
      createdAt: note.createdAt,
    };
  }
}
