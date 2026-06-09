import {
  AmaClientDto,
  AmaCreateClientInput,
  AmaSearchResultDto,
} from '../dto/ama-client.dto';

/**
 * Port for AMA Client master integration.
 *
 * Real implementation: AmaClientHttpService (axios/fetch + HMAC).
 * Test/dev:           AmaMockService (in-memory fixture).
 *
 * Mostly read-only (teacher master mirror). The single write path —
 * createClient — registers a TPI parent as an AMA client (REQ-260609 FR-C).
 */
export interface IAmaClientService {
  /**
   * Fetch single AMA Client by ID.
   * @returns null when 404 (client not found / deleted).
   * @throws AmaServiceUnavailableException on network/5xx errors.
   */
  getClient(amaClientId: string): Promise<AmaClientDto | null>;

  /**
   * Search AMA Clients by free-text query (name/clientId).
   * Used by Admin Teacher Picker.
   */
  searchClients(query: string, page?: number, limit?: number): Promise<AmaSearchResultDto>;

  /**
   * Register a parent as an AMA client under the given entity (REQ-260609 FR-C).
   * Idempotency is also guarded at the parent row (par_ama_client_id); on the
   * AMA side a duplicate (O-5) should resolve to the existing client.
   * @returns the created (or existing) AMA client record (incl. amaClientId).
   * @throws AmaServiceUnavailableException on network/5xx errors.
   */
  createClient(input: AmaCreateClientInput): Promise<AmaClientDto>;
}

export const AMA_CLIENT_SERVICE = Symbol('AMA_CLIENT_SERVICE');
