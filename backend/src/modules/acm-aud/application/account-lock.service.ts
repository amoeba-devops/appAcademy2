import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AccessLogService } from './access-log.service';
import type { ActorKind } from './aud.types';

/** REQ-261021B FR-C-4 — unlock from the access-control screen (admin lock and/or temporary lock). */
@Injectable()
export class AccountLockService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly log: AccessLogService,
  ) {}

  async unlock(
    entId: string,
    target: {
      kind: ActorKind;
      actorId?: string | null;
      failureId?: string | null;
    },
    byUserId: string,
  ): Promise<void> {
    if (!target.actorId && !target.failureId)
      throw new BadRequestException('actorId or failureId required');
    let name: string | null = null;
    let loginId: string | null = null;
    let role: string | null = null;
    if (target.actorId) {
      const [acc] =
        target.kind === 'CONSOLE'
          ? await this.ds.query<
              { name: string; loginId: string; role: string }[]
            >(
              `SELECT usr_name name, usr_email "loginId", usr_role role FROM amb_acm_user WHERE ent_id=$1 AND usr_id=$2`,
              [entId, target.actorId],
            )
          : await this.ds.query<
              { name: null; loginId: string; role: string }[]
            >(
              `SELECT NULL name, pac_login_id "loginId", pac_kind role FROM amb_acm_portal_account WHERE ent_id=$1 AND pac_id=$2`,
              [entId, target.actorId],
            );
      if (!acc) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      ({ name, loginId, role } = acc);
      if (target.kind === 'CONSOLE')
        await this.ds.query(
          `UPDATE amb_acm_user SET usr_locked_at=NULL WHERE ent_id=$1 AND usr_id=$2`,
          [entId, target.actorId],
        );
      else
        await this.ds.query(
          `UPDATE amb_acm_portal_account SET pac_locked_at=NULL WHERE ent_id=$1 AND pac_id=$2`,
          [entId, target.actorId],
        );
      await this.ds.query(
        `DELETE FROM amb_acm_aud_login_failure WHERE ent_id=$1 AND alf_actor_kind=$2 AND alf_actor_id=$3`,
        [entId, target.kind, target.actorId],
      );
    }
    if (target.failureId) {
      const [f] = await this.ds.query<{ loginId: string | null }[]>(
        `SELECT alf_login_id "loginId" FROM amb_acm_aud_login_failure WHERE ent_id=$1 AND alf_id=$2 AND alf_key NOT LIKE 'IP:%'`,
        [entId, target.failureId],
      );
      if (!f && !target.actorId) throw new NotFoundException('LOCK_NOT_FOUND');
      loginId = loginId ?? f?.loginId ?? null;
      await this.ds.query(
        `DELETE FROM amb_acm_aud_login_failure WHERE ent_id=$1 AND alf_id=$2`,
        [entId, target.failureId],
      );
    }
    await this.log.record({
      actor: {
        entId,
        kind: target.kind,
        id: target.actorId ?? null,
        name,
        role,
        loginId,
      },
      event: 'UNLOCKED',
      result: 'SUCCESS',
      reason: 'ADMIN',
      byUserId,
    });
  }
}
