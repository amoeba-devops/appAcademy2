import { Injectable, Logger } from '@nestjs/common';
import {
  AmaPlatformUser,
  AmaUserLevel,
  IAmaPlatformClient,
} from './ama-platform.client';

/**
 * Mock AMA platform client. Activated when `AMA_SERVICES_MODE=mock`.
 *
 * Fixture covers four UX shapes:
 *   • a `OWNER` (kept in the data so we can prove servers strip it — AC-3-3)
 *   • one each of MANAGER / MEMBER / VIEWER with Korean + ASCII names
 *
 * Special entityIds (same convention as the stg-apps mock):
 *   • includes "ent-fail"        → assertMember + searchUsers throw
 *   • includes "ent-not-member"  → assertMember returns null (404 proxy)
 */
@Injectable()
export class AmaPlatformMockClient implements IAmaPlatformClient {
  private readonly logger = new Logger(AmaPlatformMockClient.name);

  private fixture(entityId: string): AmaPlatformUser[] {
    return [
      {
        userId: 'ama-user-owner-1',
        entityId,
        level: 'OWNER',
        name: '대표이사',
        email: 'owner@tpi.kr',
      },
      {
        userId: 'ama-user-mgr-1',
        entityId,
        level: 'MANAGER',
        name: '김교사',
        email: 'kim.teach@tpi.kr',
      },
      {
        userId: 'ama-user-mgr-2',
        entityId,
        level: 'MANAGER',
        name: '이민지',
        email: 'minji.lee@tpi.kr',
      },
      {
        userId: 'ama-user-mem-1',
        entityId,
        level: 'MEMBER',
        name: '박조교',
        email: 'park.ta@tpi.kr',
      },
      {
        userId: 'ama-user-mem-2',
        entityId,
        level: 'MEMBER',
        name: 'Chris Park',
        email: 'chris@tpi.kr',
      },
      {
        userId: 'ama-user-view-1',
        entityId,
        level: 'VIEWER',
        name: '학원장',
        email: 'view@tpi.kr',
      },
    ];
  }

  async assertMember(
    entityId: string,
    userId: string,
  ): Promise<AmaPlatformUser | null> {
    if (entityId.toLowerCase().includes('ent-fail')) {
      throw new Error('MOCK_FAIL: simulated ama platform 5xx');
    }
    if (entityId.toLowerCase().includes('ent-not-member')) {
      return null;
    }
    const hit = this.fixture(entityId).find((u) => u.userId === userId);
    this.logger.debug(
      `mock assertMember entityId=${entityId} userId=${userId} → ${
        hit ? hit.level : 'null'
      }`,
    );
    return hit ?? null;
  }

  async searchUsers(
    entityId: string,
    q: string,
    levels: AmaUserLevel[],
    limit: number,
  ): Promise<AmaPlatformUser[]> {
    if (entityId.toLowerCase().includes('ent-fail')) {
      throw new Error('MOCK_FAIL: simulated ama platform 5xx');
    }
    const lq = (q ?? '').trim().toLowerCase();
    const allowed = new Set<string>(levels);
    const result = this.fixture(entityId)
      .filter((u) => allowed.has(u.level))
      .filter(
        (u) =>
          !lq ||
          u.name.toLowerCase().includes(lq) ||
          u.email.toLowerCase().includes(lq),
      )
      .slice(0, limit);
    this.logger.debug(
      `mock searchUsers entityId=${entityId} q="${q}" levels=${levels.join(
        ',',
      )} → ${result.length}`,
    );
    return result;
  }
}
