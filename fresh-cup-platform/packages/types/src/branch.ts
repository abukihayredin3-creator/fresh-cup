export interface Branch {
  id: string;
  name: string;
  addressText: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  isActive: boolean;
}

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
