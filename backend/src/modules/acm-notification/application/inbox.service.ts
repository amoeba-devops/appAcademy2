import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Subject, interval, merge, filter, map } from 'rxjs';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';

// Apply the same visibility predicate to list, count, read and navigation. Never trust URL/body recipient IDs.
const VISIBLE = `u.usr_status='ACTIVE' AND (
 (n.nin_type LIKE 'CSL_%' AND u.usr_role IN ('ADMIN','STAFF','APP_ADMIN') AND EXISTS
  (SELECT 1 FROM amb_acm_csl_inquiry q WHERE q.ent_id=n.ent_id AND q.inq_id=n.nin_target_id AND q.deleted_at IS NULL))
 OR (n.nin_type LIKE 'CAL_%' AND (u.usr_role IN ('ADMIN','STAFF','APP_ADMIN') OR
   (u.usr_role='TEACHER' AND EXISTS(SELECT 1 FROM amb_acm_tch_teacher t WHERE t.ent_id=n.ent_id AND t.tch_user_id=u.usr_id AND t.deleted_at IS NULL)))
   AND EXISTS(SELECT 1 FROM amb_acm_cal_event e WHERE e.ent_id=n.ent_id AND e.evt_id=n.nin_target_id AND e.deleted_at IS NULL))
 OR (n.nin_type='CHAT_MENTION' AND u.usr_role IN ('ADMIN','APP_ADMIN') AND EXISTS(
   SELECT 1 FROM amb_acm_talk_message msg JOIN amb_acm_talk_channel c ON c.ent_id=msg.ent_id AND c.tlc_id=msg.tlc_id
   JOIN amb_acm_talk_member member ON member.ent_id=c.ent_id AND member.tlc_id=c.tlc_id
   WHERE msg.ent_id=n.ent_id AND msg.tms_id=n.nin_target_id AND msg.deleted_at IS NULL AND c.deleted_at IS NULL
     AND member.tlm_kind='USER' AND member.tlm_ref_id=u.usr_id AND member.tlm_left_at IS NULL))
)`;
const FROM = `FROM amb_acm_notification_inbox n JOIN amb_acm_user u ON u.ent_id=n.ent_id AND u.usr_id=n.usr_id
 WHERE n.ent_id=$1 AND n.usr_id=$2 AND ${VISIBLE}`;
export interface InboxRow {
  id: string;
  type: string;
  targetId: string;
  payload: Record<string, string | number | null>;
  readAt: Date | null;
  createdAt: Date;
  cursorAt: string;
}
@Injectable()
export class InboxService {
  private readonly log = new Logger(InboxService.name);
  private readonly changes = new Subject<{ entId: string; userId: string }>();
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  async deliver() {
    try {
      const changed = await this.ds.transaction(async (m) => {
        const rows: { nob_id: string }[] = await m.query(
          `SELECT nob_id FROM amb_acm_notification_outbox WHERE nob_delivered_at IS NULL ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
        );
        if (!rows.length) return [];
        const ids = rows.map((r) => r.nob_id);
        const recipients: { entId: string; userId: string }[] = await m.query(
          `INSERT INTO amb_acm_notification_inbox
          (ent_id,usr_id,nob_id,nin_type,nin_target_id,nin_payload)
          SELECT o.ent_id,r.value::uuid,o.nob_id,o.nob_type,o.nob_target_id,o.nob_payload
          FROM amb_acm_notification_outbox o CROSS JOIN LATERAL jsonb_array_elements_text(o.nob_recipients) r
          JOIN amb_acm_user u ON u.ent_id=o.ent_id AND u.usr_id=r.value::uuid AND u.usr_status='ACTIVE'
          WHERE o.nob_id=ANY($1::uuid[]) ON CONFLICT DO NOTHING RETURNING ent_id AS "entId",usr_id AS "userId"`,
          [ids],
        );
        await m.query(
          'UPDATE amb_acm_notification_outbox SET nob_delivered_at=now() WHERE nob_id=ANY($1::uuid[])',
          [ids],
        );
        return recipients;
      });
      for (const recipient of changed) this.changes.next(recipient);
    } catch {
      this.log.error(
        'Notification outbox delivery failed; pending events retained for retry',
      );
    }
  }
  events(u: AcmCurrentUser) {
    return merge(
      this.changes.pipe(
        filter((e) => e.entId === u.entId && e.userId === u.id),
      ),
      interval(25000),
    ).pipe(map(() => ({ data: JSON.stringify({ type: 'inbox:refresh' }) })));
  }
  async list(u: AcmCurrentUser, cursor?: string, unread = false) {
    let tail = '';
    const params: unknown[] = [u.entId, u.id];
    if (cursor) {
      let c: unknown;
      try {
        c = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      } catch {
        throw new BadRequestException('INVALID_CURSOR');
      }
      if (
        !c ||
        typeof c !== 'object' ||
        !('at' in c) ||
        !('id' in c) ||
        typeof c.at !== 'string' ||
        !Number.isFinite(Date.parse(c.at)) ||
        typeof c.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          c.id,
        )
      )
        throw new BadRequestException('INVALID_CURSOR');
      params.push(c.at, c.id);
      tail = ' AND (n.created_at,n.nin_id)<($3::timestamptz,$4::uuid)';
    }
    const rows: InboxRow[] = await this.ds.query(
      `SELECT n.nin_id AS id,n.nin_type AS type,n.nin_target_id AS "targetId",n.nin_payload AS payload,n.nin_read_at AS "readAt",n.created_at AS "createdAt",n.created_at::text AS "cursorAt" ${FROM} ${unread ? 'AND n.nin_read_at IS NULL' : ''} ${tail} ORDER BY n.created_at DESC,n.nin_id DESC LIMIT 21`,
      params,
    );
    const items = rows.slice(0, 20);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > 20 && last
          ? Buffer.from(
              JSON.stringify({ at: last.cursorAt, id: last.id }),
            ).toString('base64url')
          : null,
      ...(await this.count(u)),
    };
  }
  async count(u: AcmCurrentUser) {
    const [row]: { unreadCount: number; asOf: string }[] = await this.ds.query(
      `SELECT count(*)::int AS "unreadCount",to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "asOf" ${FROM} AND n.nin_read_at IS NULL`,
      [u.entId, u.id],
    );
    return row;
  }
  async read(u: AcmCurrentUser, id: string) {
    const rows: InboxRow[] = await this.ds.query(
      `SELECT n.nin_id AS id,n.nin_type AS type,n.nin_target_id AS "targetId",n.nin_payload AS payload ${FROM} AND n.nin_id=$3`,
      [u.entId, u.id, id],
    );
    if (!rows.length) throw new NotFoundException('NOTIFICATION_UNAVAILABLE');
    await this.ds.query(
      'UPDATE amb_acm_notification_inbox SET nin_read_at=COALESCE(nin_read_at,now()) WHERE ent_id=$1 AND usr_id=$2 AND nin_id=$3',
      [u.entId, u.id, id],
    );
    this.changes.next({ entId: u.entId, userId: u.id });
    const n = rows[0];
    return {
      href: n.type.startsWith('CSL_')
        ? `/admin/csl/${n.targetId}`
        : n.type.startsWith('CAL_')
          ? `/admin/cal/${n.targetId}`
          : `/admin/chat?channelId=${encodeURIComponent(String(n.payload.channelId))}&messageId=${n.targetId}`,
    };
  }
  async readAll(u: AcmCurrentUser, asOf: string) {
    if (typeof asOf !== 'string' || !Number.isFinite(Date.parse(asOf)))
      throw new BadRequestException('INVALID_CUTOFF');
    await this.ds.query(
      `UPDATE amb_acm_notification_inbox SET nin_read_at=COALESCE(nin_read_at,now()) WHERE nin_id IN (SELECT n.nin_id ${FROM} AND n.created_at<=LEAST($3::timestamptz,clock_timestamp()))`,
      [u.entId, u.id, asOf],
    );
    this.changes.next({ entId: u.entId, userId: u.id });
    return this.count(u);
  }
}
