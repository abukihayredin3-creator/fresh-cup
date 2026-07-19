export interface Branch {
  id: string;
  name: string;
  addressText: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  managerId: string | null;
  isActive: boolean;
}

/** One entry per day-of-week (0 = Sunday .. 6 = Saturday). */
export interface BranchHours {
  id: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface BranchHoursDayInput {
  dayOfWeek: number;
  opensAt?: string;
  closesAt?: string;
  isClosed: boolean;
}

export interface CreateBranchInput {
  name: string;
  addressText: string;
  lat?: number;
  lng?: number;
  phone?: string;
  managerId?: string;
}

export type UpdateBranchInput = Partial<CreateBranchInput> & { isActive?: boolean };

export interface Table {
  id: string;
  branchId: string;
  label: string;
  qrToken: string;
  isActive: boolean;
}

/** What scanning a table's QR code resolves to — just enough to start a dine-in order. */
export interface ResolveTableResult {
  tableId: string;
  tableLabel: string;
  branchId: string;
  branchName: string;
}
