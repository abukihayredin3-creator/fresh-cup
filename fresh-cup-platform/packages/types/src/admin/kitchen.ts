export interface KitchenStation {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface CreateKitchenStationInput {
  branchId: string;
  name: string;
}

export type UpdateKitchenStationInput = Partial<Omit<CreateKitchenStationInput, "branchId">> & {
  isActive?: boolean;
};
