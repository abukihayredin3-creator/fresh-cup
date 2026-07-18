import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditLogsService } from "./audit-logs.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@ApiTags("audit")
@Controller("admin/audit-logs")
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: "List audit log entries (admin only)" })
  async list(@Query() query: ListAuditLogsQueryDto) {
    const page = await this.auditLogsService.list(query);
    return { ...page, items: page.items.map((l) => this.auditLogsService.toResponse(l)) };
  }
}
