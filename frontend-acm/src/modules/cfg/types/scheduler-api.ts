export type ApiScope =
  "teachers:read" | "lessons:read" | "lessons:write" | "students:read";
export const API_SCOPES: ApiScope[] = [
  "teachers:read",
  "lessons:read",
  "lessons:write",
  "students:read",
];
export interface ApiSettings {
  enabled: boolean;
  scopes: ApiScope[];
}
export interface ApiField {
  name: string;
  in: string;
  required: boolean;
  type: string;
  description: string;
  example: unknown;
  values?: string[];
  limit?: string;
}
export interface ApiEntry {
  id: string;
  group: string;
  name: string;
  method: string;
  path: string;
  scope: ApiScope;
  fields: ApiField[];
  request: unknown;
  response: unknown;
}
export interface ApiCatalog {
  basePath: string;
  version: string;
  status: string;
  apis: ApiEntry[];
  errors: { status: number; code: string; description: string }[];
}
export interface ApiKey {
  id: string;
  name: string;
  scopes: ApiScope[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}
export interface ApiClient {
  id: string;
  name: string;
  active: boolean;
  actorId: string;
  keys: ApiKey[];
}
