import { AmaClientDto, AmaSearchResultDto } from '../dto/ama-client.dto';

/**
 * Port for AMA Client master integration.
 *
 * Real implementation: AmaClientHttpService (axios/fetch + HMAC).
 * Test/dev:           AmaMockService (in-memory fixture).
 *
 * Read-only: TAC never writes to AMA.
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
}

export const AMA_CLIENT_SERVICE = Symbol('AMA_CLIENT_SERVICE');
