// STF module types — mirrors backend DTO.

export type StfStatus = 'ACTIVE' | 'INACTIVE';

export interface StaffDetail {
  id: string;
  entId: string;
  name: string;
  englishName?: string | null;
  email: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  hiredAt?: string | null;
  memo?: string | null;
  userId?: string | null;
  hasAccount: boolean;
  status: StfStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListStaffResponse {
  items: StaffDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface ListStaffQuery {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}
