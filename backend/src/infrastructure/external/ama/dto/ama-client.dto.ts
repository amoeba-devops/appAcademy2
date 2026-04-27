/**
 * AMA Client — external master record (read-only mirror in TAC).
 *
 * Source of truth: AMA platform. TAC must never write back.
 */
export interface AmaClientDto {
  amaClientId: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string; // 'ACTIVE' | 'INACTIVE' | 'DELETED' (AMA-side)
  employmentType?: string | null;
  profileImageUrl?: string | null;
  updatedAt: string; // ISO 8601 from AMA
}

export interface AmaSearchResultDto {
  data: AmaClientDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
