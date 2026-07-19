import { Injectable, NotFoundException } from "@nestjs/common";
import type { Department } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateDepartmentDto } from "./dto/create-department.dto";
import type { DepartmentResponseDto } from "./dto/department-response.dto";
import type { UpdateDepartmentDto } from "./dto/update-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId?: string): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { name: "asc" },
    });
  }

  async findByIdOrThrow(id: string): Promise<Department> {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  create(dto: CreateDepartmentDto): Promise<Department> {
    return this.prisma.department.create({ data: dto });
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    await this.findByIdOrThrow(id);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.department.delete({ where: { id } });
  }

  toResponse(department: Department): DepartmentResponseDto {
    return { id: department.id, branchId: department.branchId, name: department.name };
  }
}
