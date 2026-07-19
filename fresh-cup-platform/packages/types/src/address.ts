export interface Address {
  id: string;
  label: string;
  freeText: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAddressInput {
  label: string;
  freeText: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export type UpdateAddressInput = Partial<CreateAddressInput>;
