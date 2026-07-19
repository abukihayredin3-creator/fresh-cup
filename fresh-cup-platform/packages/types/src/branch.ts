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
