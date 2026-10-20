import { pushText } from './push-text';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import * as webpush from 'web-push';
import { ACM_DS } from '../../acm-common/datasource';
import { InboxService, InboxActor } from './inbox.service';

export function validPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === 'https:' &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.hash &&
      (u.hostname === 'fcm.googleapis.com' ||
        u.hostname === 'updates.push.services.mozilla.com' ||
        u.hostname.endsWith('.push.apple.com') ||
        u.hostname === 'web.push.apple.com' ||
        u.hostname === 'wns2-par02p.notify.windows.com' ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname))
    );
  } catch {
    return false;
  }
}
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly inbox: InboxService,
  ) {}
  private vapid() {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.config.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject = this.config.get<string>('WEB_PUSH_SUBJECT');
    return publicKey && privateKey && subject
      ? { publicKey, privateKey, subject }
      : null;
  }
  info() {
    const v = this.vapid();
    return { enabled: !!v, publicKey: v?.publicKey ?? null };
  }
  async subscribe(u: InboxActor, subscription: webpush.PushSubscription) {
    if (!this.vapid())
      throw new ServiceUnavailableException('PUSH_NOT_CONFIGURED');
    if (!validPushEndpoint(subscription.endpoint))
      throw new BadRequestException('INVALID_PUSH_ENDPOINT');
    if (
      Buffer.from(subscription.keys.p256dh, 'base64url').length !== 65 ||
      Buffer.from(subscription.keys.auth, 'base64url').length !== 16
    )
      throw new BadRequestException('INVALID_PUSH_KEYS');
    const kind = u.kind ?? 'USER';
    const rows: { id: string }[] = await this.ds.query(
      `INSERT INTO amb_acm_push_subscription(ent_id,psu_kind,psu_recipient_id,psu_endpoint_hash,psu_subscription) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(psu_endpoint_hash) DO UPDATE SET ent_id=excluded.ent_id,psu_kind=excluded.psu_kind,psu_recipient_id=excluded.psu_recipient_id,psu_subscription=excluded.psu_subscription,updated_at=now(),
      created_at=CASE WHEN amb_acm_push_subscription.ent_id=excluded.ent_id AND amb_acm_push_subscription.psu_kind=excluded.psu_kind AND amb_acm_push_subscription.psu_recipient_id=excluded.psu_recipient_id THEN amb_acm_push_subscription.created_at ELSE now() END RETURNING psu_id AS id`,
      [
        u.entId,
        kind,
        u.id,
        createHash('sha256').update(subscription.endpoint).digest('hex'),
        subscription,
      ],
    );
    return { id: rows[0].id, actor: `${u.entId}:${kind}:${u.id}` };
  }
  async remove(u: InboxActor, id: string) {
    await this.ds.query(
      `DELETE FROM amb_acm_push_subscription WHERE psu_id=$1 AND ent_id=$2 AND psu_kind=$3 AND psu_recipient_id=$4`,
      [id, u.entId, u.kind ?? 'USER', u.id],
    );
    return { ok: true };
  }
  private clickHref(
    u: InboxActor,
    item: Parameters<InboxService['href']>[1] & { id: string },
  ): string {
    const url = new URL(this.inbox.href(u, item), 'https://acm.invalid');
    url.searchParams.set('notificationId', item.id);
    return url.pathname + url.search + url.hash;
  }
  @Cron('*/10 * * * * *', { waitForCompletion: true })
  async deliver() {
    const vapidDetails = this.vapid();
    if (!vapidDetails) return;
    try {
      await this.ds
        .query(`INSERT INTO amb_acm_push_delivery(ent_id,psu_id,nin_id)
        SELECT n.ent_id,s.psu_id,n.nin_id FROM amb_acm_notification_inbox n JOIN amb_acm_push_subscription s
        ON s.ent_id=n.ent_id AND s.psu_kind=n.nin_recipient_kind AND s.psu_recipient_id=n.nin_recipient_id
        WHERE n.nin_read_at IS NULL AND n.created_at>=s.created_at AND n.created_at>now()-interval '1 day'
        AND s.updated_at>now()-interval '30 days' ON CONFLICT DO NOTHING`);
      const rows: {
        id: string;
        subscriptionId: string;
        inboxId: string;
        entId: string;
        kind: 'USER' | 'TEACHER';
        recipient: string;
        subscription: webpush.PushSubscription;
        attempts: number;
      }[] = await this.ds.transaction(async (m) =>
        m.query(`
        WITH claimed AS(SELECT pdl_id FROM amb_acm_push_delivery WHERE pdl_done_at IS NULL AND pdl_next_at<=now() AND pdl_attempts<5 ORDER BY pdl_next_at LIMIT 20 FOR UPDATE SKIP LOCKED),
        leased AS(UPDATE amb_acm_push_delivery d SET pdl_attempts=d.pdl_attempts+1,pdl_next_at=now()+interval '5 minutes' FROM claimed c WHERE d.pdl_id=c.pdl_id RETURNING d.*)
        SELECT d.pdl_id AS id,d.psu_id AS "subscriptionId",d.nin_id AS "inboxId",s.ent_id AS "entId",s.psu_kind AS kind,s.psu_recipient_id AS recipient,s.psu_subscription AS subscription,d.pdl_attempts AS attempts
        FROM leased d JOIN amb_acm_push_subscription s ON s.psu_id=d.psu_id JOIN amb_acm_notification_inbox n ON n.nin_id=d.nin_id
        WHERE s.ent_id=n.ent_id AND s.psu_kind=n.nin_recipient_kind AND s.psu_recipient_id=n.nin_recipient_id`),
      );
      for (const row of rows) {
        const u: InboxActor = {
          entId: row.entId,
          id: row.recipient,
          ...(row.kind === 'TEACHER' ? { kind: 'TEACHER' as const } : {}),
        };
        const item = await this.inbox.unreadItem(u, row.inboxId);
        try {
          if (item)
            await webpush.sendNotification(
              row.subscription,
              JSON.stringify({
                // REQ-261020C — 종류별 문구(본문 미포함)
                ...pushText(item),
                url: this.clickHref(u, item),
                tag: row.inboxId,
                actor: `${row.entId}:${row.kind}:${row.recipient}`,
              }),
              {
                vapidDetails,
                TTL: 3600,
                timeout: 10000,
                topic: createHash('sha256')
                  .update(row.inboxId)
                  .digest('base64url')
                  .slice(0, 32),
              },
            );
          await this.ds.query(
            'UPDATE amb_acm_push_delivery SET pdl_done_at=now() WHERE pdl_id=$1',
            [row.id],
          );
        } catch (e: unknown) {
          const code =
            e && typeof e === 'object' && 'statusCode' in e
              ? Number(e.statusCode)
              : 0;
          if (code === 404 || code === 410)
            await this.ds.query(
              'DELETE FROM amb_acm_push_subscription WHERE psu_id=$1',
              [row.subscriptionId],
            );
          else if (
            (code >= 400 && code < 500 && code !== 429) ||
            row.attempts >= 5
          )
            await this.ds.query(
              'UPDATE amb_acm_push_delivery SET pdl_done_at=now() WHERE pdl_id=$1',
              [row.id],
            );
          // No endpoint, subscription key, or payload in logs.
          this.log.warn(`Push delivery failed (status=${code || 'network'})`);
        }
      }
    } catch {
      this.log.error('Push delivery sweep failed; pending work retained');
    }
  }
}
