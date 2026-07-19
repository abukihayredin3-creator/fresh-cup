import type { PermissionKey, ShiftStatus } from "../enums";

export interface Department {
  id: string;
  branchId: string | null;
  name: string;
}

export interface CreateDepartmentInput {
  branchId?: string;
  name: string;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export interface Shift {
  id: string;
  userId: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  notes: string | null;
}

export interface CreateShiftInput {
  userId: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
}

export type UpdateShiftInput = Partial<CreateShiftInput> & { status?: ShiftStatus };

export interface ListShiftsParams {
  branchId?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export interface Attendance {
  id: string;
  userId: string;
  branchId: string;
  clockInAt: string;
  clockOutAt: string | null;
}

export interface ListAttendanceParams {
  branchId?: string;
  userId?: string;
}

export interface StaffPermission {
  id: string;
  userId: string;
  permission: PermissionKey;
  grantedByUserId: string | null;
  createdAt: string;
}

export interface PerformanceNote {
  id: string;
  userId: string;
  authorUserId: string | null;
  rating: number | null;
  note: string;
  createdAt: string;
}

export interface CreatePerformanceNoteInput {
  rating?: number;
  note: string;
}
