/**
 * ama.amoeba.site — AMA Platform user/entity directory.
 *
 * Two distinct calls funneled through a single port (so mock + http can
 * stay in lock-step):
 *
 *   1. assertMember(entityId, userId) — REQ-260604 v2 FR-2 (A2)
 *      Verifies the AMA-JWT-claimed user is still a member of the entity at
 *      login time. Returns the user record on 200, null on 404, throws on
 *      5xx/timeout (caller must fail-closed since membership cannot be
 *      verified from a cache — it changes too fast to trust).
 *
 *   2. searchUsers(entityId, q, levels, limit) — REQ-260604 v2 FR-3/4 (A3)
 *      Returns up to N entity members matching free-text q whose level is
 *      in `levels`. Used by AmaUserPicker (T5) for /admin/tch + /admin/stf
 *      add modals.
 *
 * Selection driven by env `AMA_SERVICES_MODE` (mock|http) — same toggle as
 * the stg-apps subscription client.
 */

export const AMA_USER_LEVELS = [
  'OWNER',
  'MANAGER',
  'MEMBER',
  'VIEWER',
] as const;

export type AmaUserLevel = (typeof AMA_USER_LEVELS)[number];

export interface AmaPlatformUser {
  userId: string;
  entityId: string;
  level: AmaUserLevel;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

/**
 * Thrown by HTTP client implementations on 5xx, network error, or timeout.
 * For `assertMember` this propagates as 503 AMA_UNAVAILABLE because
 * membership has no safe cache fallback. For `searchUsers` the directory
 * service degrades to an empty result + UI manual-input fallback.
 */
export class AmaPlatformUnavailableException extends Error {
  constructor(
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(`ama platform unavailable: ${reason}`);
    this.name = 'AmaPlatformUnavailableException';
  }
}

export interface IAmaPlatformClient {
  /**
   * @returns the user record on 200, null on 404.
   * @throws AmaPlatformUnavailableException on 5xx / network / timeout.
   */
  assertMember(
    entityId: string,
    userId: string,
  ): Promise<AmaPlatformUser | null>;

  /**
   * Returns matching members. The platform's own filter is the source of
   * truth; the caller (AmaUserDirectoryService) STILL re-applies the level
   * whitelist defensively (REQ-260604 v2 FR-5 / AC-3-3).
   */
  searchUsers(
    entityId: string,
    q: string,
    levels: AmaUserLevel[],
    limit: number,
  ): Promise<AmaPlatformUser[]>;
}

export const AMA_PLATFORM_CLIENT = Symbol('AMA_PLATFORM_CLIENT');
