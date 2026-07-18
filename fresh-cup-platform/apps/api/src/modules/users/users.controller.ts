import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../common/audit/auditable.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller()
@Auditable("User")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("users/me")
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@CurrentUser() user: RequestUser): Promise<UserResponseDto> {
    const record = await this.usersService.findByIdOrThrow(user.id);
    return this.usersService.toResponse(record);
  }

  @Patch("users/me")
  @ApiOperation({ summary: "Update the authenticated user's profile" })
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return this.usersService.toResponse(updated);
  }

  @Get("admin/users")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "List users (admin/manager — managers see only their branch)" })
  async listUsers(@CurrentUser() actor: RequestUser, @Query() query: ListUsersQueryDto) {
    const page = await this.usersService.listUsers(actor, query);
    return { ...page, items: page.items.map((u) => this.usersService.toResponse(u)) };
  }

  @Get("admin/users/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Get a user by id (admin/manager)" })
  @ApiOkResponse({ type: UserResponseDto })
  async getUser(@Param("id") id: string): Promise<UserResponseDto> {
    const record = await this.usersService.findByIdOrThrow(id);
    return this.usersService.toResponse(record);
  }

  @Post("admin/users")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Create a staff/manager/admin user (admin only)" })
  @ApiOkResponse({ type: UserResponseDto })
  async createStaffUser(@Body() dto: CreateStaffUserDto): Promise<UserResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    UsersService.assertUniqueEmailAvailable(existing, dto.email);
    const created = await this.usersService.createStaffUser(dto);
    return this.usersService.toResponse(created);
  }

  @Patch("admin/users/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Update a user (admin/manager — managers scoped to their branch)" })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUser(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.adminUpdateUser(actor, id, dto);
    return this.usersService.toResponse(updated);
  }
}
