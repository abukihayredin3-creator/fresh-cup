import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance/attendance.controller";
import { AttendanceService } from "./attendance/attendance.service";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentsService } from "./departments/departments.service";
import { PerformanceController } from "./performance/performance.controller";
import { PerformanceService } from "./performance/performance.service";
import { PermissionsController } from "./permissions/permissions.controller";
import { PermissionsService } from "./permissions/permissions.service";
import { ShiftsController } from "./shifts/shifts.controller";
import { ShiftsService } from "./shifts/shifts.service";

@Module({
  controllers: [
    DepartmentsController,
    ShiftsController,
    AttendanceController,
    PerformanceController,
    PermissionsController,
  ],
  providers: [
    DepartmentsService,
    ShiftsService,
    AttendanceService,
    PerformanceService,
    PermissionsService,
  ],
  exports: [DepartmentsService, ShiftsService, AttendanceService],
})
export class EmployeesModule {}
