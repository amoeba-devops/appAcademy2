import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AMA_PLATFORM_CLIENT,
  AmaPlatformUnavailableException,
  type AmaPlatformUser,
  type IAmaPlatformClient,
} from '../infrastructure/ama-platform.client';

/**
 * REQ-260604 v2 FR-2 — confirms the AMA-JWT-claimed user still belongs to
 * the claimed entity at login time.
 *
 * Membership is queried live (no cache). Failure modes:
 *   • 404                       → 403 USER_NOT_IN_ENTITY
 *   • 5xx / network / timeout   → 503 AMA_UNAVAILABLE (fail-closed)
 *
 * Why no cache fallback like SubscriptionCheckService has? Membership can
 * change minute-to-minute (HR removing a user from an entity); a stale
 * "yes you're a member" cache is exactly the wrong thing to trust on a
 * security boundary. Subscription is the AMA tenant's billing state and
 * the webhook ledger gives us a defensible 24h grace window — membership
 * has no such ledger.
 */
@Injectable()
export class UserMembershipGuard {
  private readonly logger = new Logger(UserMembershipGuard.name);

  constructor(
    @Inject(AMA_PLATFORM_CLIENT)
    private readonly platform: IAmaPlatformClient,
  ) {}

  async ensureMember(
    entityId: string,
    userId: string,
  ): Promise<AmaPlatformUser> {
    let member: AmaPlatformUser | null;
    try {
      member = await this.platform.assertMember(entityId, userId);
    } catch (e) {
      const reason =
        e instanceof AmaPlatformUnavailableException
          ? e.reason
          : e instanceof Error
            ? e.message
            : String(e);
      this.logger.error(
        `membership check failed entId=${entityId} userId=${userId} reason=${reason}`,
      );
      throw new HttpException(
        {
          code: 'AMA_UNAVAILABLE',
          message: 'AMA platform unavailable — cannot verify membership',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!member) {
      this.logger.warn(
        `membership denied entId=${entityId} userId=${userId} reason=USER_NOT_IN_ENTITY`,
      );
      throw new HttpException(
        {
          code: 'USER_NOT_IN_ENTITY',
          message: 'User is not a member of the claimed entity',
          data: { entityId, userId },
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return member;
  }
}
