export interface ScimUserResource {
  schemas: string[];
  id: string;
  userName: string;
  name: { formatted: string };
  emails: { value: string; primary: boolean }[];
  active: boolean;
}

export interface ScimListResponse {
  schemas: string[];
  totalResults: number;
  itemsPerPage: number;
  startIndex: number;
  Resources: ScimUserResource[];
}

export interface ScimPatchOperation {
  op: "replace" | "add" | "remove";
  path?: string;
  value?: unknown;
}
