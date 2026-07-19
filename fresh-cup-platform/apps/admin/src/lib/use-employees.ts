import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  CreateDepartmentInput,
  CreatePerformanceNoteInput,
  CreateShiftInput,
  ListAttendanceParams,
  ListShiftsParams,
  PermissionKey,
  UpdateDepartmentInput,
  UpdateShiftInput,
  UserRole,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useEmployees(params: PaginationParams & { role?: UserRole; branchId?: string }) {
  return useQuery({
    queryKey: ["admin-employees", params],
    queryFn: () => api.admin.users.list({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ["admin-employee", id],
    queryFn: () => api.admin.users.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateUserInput) => api.admin.users.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUpdateUserInput) => api.admin.users.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-employee", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => api.admin.employees.listDepartments(),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => api.admin.employees.createDepartment(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-departments"] }),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
      api.admin.employees.updateDepartment(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-departments"] }),
  });
}

export function useRemoveDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.employees.removeDepartment(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-departments"] }),
  });
}

export function usePermissions(userId: string) {
  return useQuery({
    queryKey: ["admin-permissions", userId],
    queryFn: () => api.admin.employees.listPermissions(userId),
    enabled: Boolean(userId),
  });
}

export function useGrantPermission(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permission: PermissionKey) =>
      api.admin.employees.grantPermission(userId, permission),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-permissions", userId] }),
  });
}

export function useRevokePermission(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permission: PermissionKey) =>
      api.admin.employees.revokePermission(userId, permission),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-permissions", userId] }),
  });
}

export function usePerformanceNotes(userId: string) {
  return useQuery({
    queryKey: ["admin-performance-notes", userId],
    queryFn: () => api.admin.employees.listPerformanceNotes(userId),
    enabled: Boolean(userId),
  });
}

export function useCreatePerformanceNote(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePerformanceNoteInput) =>
      api.admin.employees.createPerformanceNote(userId, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["admin-performance-notes", userId] }),
  });
}

export function useShifts(params: PaginationParams & ListShiftsParams) {
  return useQuery({
    queryKey: ["admin-shifts", params],
    queryFn: () => api.admin.employees.listShifts({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShiftInput) => api.admin.employees.createShift(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-shifts"] }),
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShiftInput }) =>
      api.admin.employees.updateShift(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-shifts"] }),
  });
}

export function useRemoveShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.employees.removeShift(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-shifts"] }),
  });
}

export function useAttendance(params: PaginationParams & ListAttendanceParams) {
  return useQuery({
    queryKey: ["admin-attendance", params],
    queryFn: () => api.admin.employees.listAttendance({ ...params, limit: params.limit ?? 50 }),
  });
}
