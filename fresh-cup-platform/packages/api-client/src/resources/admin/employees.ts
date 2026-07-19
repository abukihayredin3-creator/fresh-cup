import type {
  Attendance,
  CreateDepartmentInput,
  CreatePerformanceNoteInput,
  CreateShiftInput,
  Department,
  ListAttendanceParams,
  ListShiftsParams,
  PaginatedResult,
  PerformanceNote,
  PermissionKey,
  Shift,
  StaffPermission,
  UpdateDepartmentInput,
  UpdateShiftInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminEmployeesResource {
  constructor(private readonly client: ApiClient) {}

  listDepartments(): Promise<PaginatedResult<Department>> {
    return this.client.request("/admin/departments");
  }

  createDepartment(input: CreateDepartmentInput): Promise<Department> {
    return this.client.request("/admin/departments", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateDepartment(id: string, input: UpdateDepartmentInput): Promise<Department> {
    return this.client.request(`/admin/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeDepartment(id: string): Promise<void> {
    return this.client.request(`/admin/departments/${id}`, { method: "DELETE" });
  }

  listShifts(params: PaginationParams & ListShiftsParams = {}): Promise<PaginatedResult<Shift>> {
    return this.client.request(`/admin/shifts${toQueryString(params)}`);
  }

  createShift(input: CreateShiftInput): Promise<Shift> {
    return this.client.request("/admin/shifts", { method: "POST", body: JSON.stringify(input) });
  }

  updateShift(id: string, input: UpdateShiftInput): Promise<Shift> {
    return this.client.request(`/admin/shifts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeShift(id: string): Promise<void> {
    return this.client.request(`/admin/shifts/${id}`, { method: "DELETE" });
  }

  clockIn(branchId: string): Promise<Attendance> {
    return this.client.request("/admin/attendance/clock-in", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    });
  }

  clockOut(): Promise<Attendance> {
    return this.client.request("/admin/attendance/clock-out", { method: "POST" });
  }

  listAttendance(
    params: PaginationParams & ListAttendanceParams = {},
  ): Promise<PaginatedResult<Attendance>> {
    return this.client.request(`/admin/attendance${toQueryString(params)}`);
  }

  listPerformanceNotes(userId: string): Promise<PerformanceNote[]> {
    return this.client.request(`/admin/users/${userId}/performance-notes`);
  }

  createPerformanceNote(
    userId: string,
    input: CreatePerformanceNoteInput,
  ): Promise<PerformanceNote> {
    return this.client.request(`/admin/users/${userId}/performance-notes`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listPermissions(userId: string): Promise<StaffPermission[]> {
    return this.client.request(`/admin/users/${userId}/permissions`);
  }

  grantPermission(userId: string, permission: PermissionKey): Promise<StaffPermission> {
    return this.client.request(`/admin/users/${userId}/permissions`, {
      method: "POST",
      body: JSON.stringify({ permission }),
    });
  }

  revokePermission(userId: string, permission: PermissionKey): Promise<void> {
    return this.client.request(`/admin/users/${userId}/permissions/${permission}`, {
      method: "DELETE",
    });
  }
}
