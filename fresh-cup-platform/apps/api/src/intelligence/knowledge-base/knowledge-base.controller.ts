import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import { UpdateKnowledgeDocumentDto } from "./dto/update-knowledge-document.dto";
import { KnowledgeBaseService } from "./knowledge-base.service";

/** AI Knowledge Base — policies, recipes, manuals, food safety, HR, supplier, marketing/architecture/API docs. */
@ApiTags("ai-knowledge-base")
@Controller("admin/ai/knowledge")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBase: KnowledgeBaseService) {}

  @Get()
  @ApiOperation({ summary: "List knowledge documents, optionally filtered by category" })
  list(@Query("category") category?: string) {
    return this.knowledgeBase.list(category);
  }

  @Get("search")
  @ApiOperation({ summary: "Hybrid (semantic + keyword) search over the knowledge base" })
  search(@Query("q") query: string, @Query("topK") topK?: string) {
    return this.knowledgeBase.search(query, topK ? Number(topK) : undefined);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch one knowledge document" })
  findOne(@Param("id") id: string) {
    return this.knowledgeBase.findByIdOrThrow(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a knowledge document and index it for search" })
  create(@Body() dto: CreateKnowledgeDocumentDto) {
    return this.knowledgeBase.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a knowledge document and re-index it" })
  update(@Param("id") id: string, @Body() dto: UpdateKnowledgeDocumentDto) {
    return this.knowledgeBase.update(id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Delete a knowledge document and its index entry (admin only)" })
  remove(@Param("id") id: string) {
    return this.knowledgeBase.delete(id);
  }
}
