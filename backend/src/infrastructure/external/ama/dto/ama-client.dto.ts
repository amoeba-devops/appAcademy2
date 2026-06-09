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

/**
 * Payload to register a new AMA client under an entity (REQ-260609 FR-C).
 * The exact wire contract (endpoint / auth / dup behaviour) is O-1..O-5,
 * pending confirmation from the AMA platform team.
 */
export interface AmaCreateClientInput {
  /** AMA entity (tenant) UUID the client is created under — e.g. TPI/VN3040. */
  entityId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}
