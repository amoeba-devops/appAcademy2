import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  AMA_OPEN_NOTIFICATION_CLIENT,
  AmaOpenNotificationRejectedException,
  AmaOpenNotificationUnavailableException,
  type IAmaOpenNotificationClient,
} from '../../../infrastructure/external/ama/open-notification/ama-open-notification.client';
import {
  forwardHref,
  forwardLink,
  normalizeForwardLocale,
  renderForward,
  type ForwardLocale,
} from './ama-forward-templates';

/** 재시도 상한 — 지수 백오프(2^n 분). */
const MAX_ATTEMPTS = 5;

interface ForwardRow {
  anf_id: string;
  ent_id: string;
  anf_type: string;
  anf_target_id: string;
  anf_payload: Record<string, string | number | null>;
  anf_recipients: string[];
  anf_dedupe_key: string;
  anf_attempts: number;
  ama_entity_id: string;
  app_code: string;
}

/**
 * REQ-261006 — ACM 알림(outbox) → AMA 알림 전달 워커.
 *
 *  1) enqueue: 전달이 켜진 테넌트의 outbox 중 (켠 시각 이후, 대상 종류, 인앱 배달 완료)
 *     건을 forward 행으로 복제. 수신자 = 인앱 수신자 중 AMA 사용자 id 가 있는 콘솔 계정.
 *     AMA 수신자가 없으면 SKIPPED.
 *  2) send: PENDING 행을 AMA Open API 로 전송. 5xx/네트워크는 백오프 재시도, 4xx 는 FAILED.
 *
 * 인앱 배달(InboxService)과 트랜잭션이 분리돼 있어 외부 실패가 콘솔 알림을 막지 않는다.
 */
@Injectable()
export class AmaForwardService {
  private readonly log = new Logger(AmaForwardService.name);
  private running = false;
  private readonly locale: ForwardLocale;
  private readonly publicUrl: string;

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @Inject(AMA_OPEN_NOTIFICATION_CLIENT)
    private readonly client: IAmaOpenNotificationClient,
    config: ConfigService,
  ) {
    this.locale = normalizeForwardLocale(
      config.get('AMA_FORWARD_LOCALE', 'ko'),
    );
    this.publicUrl =
      config.get<string>('ACM_PUBLIC_URL') ??
      config.get<string>('FRONTEND_URL') ??
      'https://acm.amoeba.site';
  }

  @Cron('*/10 * * * * *', { name: 'ama-notification-forward' })
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const queued = await this.enqueue();
      const sent = await this.sendPending(20);
      if (queued || sent.sent || sent.failed) {
        this.log.log(
          `ama forward: queued=${queued} sent=${sent.sent} retry=${sent.retry} failed=${sent.failed}`,
        );
      }
    } catch (e) {
      this.log.error(
        `ama forward sweep failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** outbox → forward 복제 (멱등: nob_id UNIQUE). */
  async enqueue(): Promise<number> {
    const rows: Array<{ anf_id: string }> = await this.ds.query(
      `INSERT INTO amb_acm_ama_notification_forward
         (ent_id, nob_id, anf_type, anf_target_id, anf_payload, anf_recipients, anf_dedupe_key, anf_status)
       SELECT o.ent_id, o.nob_id, o.nob_type, o.nob_target_id, o.nob_payload,
              COALESCE(jsonb_agg(DISTINCT u.ama_user_id) FILTER (WHERE u.ama_user_id IS NOT NULL), '[]'::jsonb),
              'acm:' || o.nob_type || ':' || o.nob_id::text,
              CASE WHEN count(u.ama_user_id) = 0 THEN 'SKIPPED' ELSE 'PENDING' END
         FROM amb_acm_notification_outbox o
         JOIN amb_acm_ama_config c
           ON c.ent_id = o.ent_id AND c.amc_is_active AND c.amc_forward_enabled
          AND o.nob_type = ANY (string_to_array(c.amc_forward_types, ','))
          AND o.created_at >= COALESCE(c.amc_forward_enabled_at, c.updated_at)
         LEFT JOIN amb_acm_notification_inbox i
           ON i.nob_id = o.nob_id AND COALESCE(i.nin_recipient_kind, 'USER') = 'USER'
         LEFT JOIN amb_acm_user u
           ON u.usr_id = i.usr_id AND u.ent_id = o.ent_id AND u.ama_user_id IS NOT NULL AND u.usr_status = 'ACTIVE'
        WHERE o.nob_delivered_at IS NOT NULL
          AND o.created_at > now() - interval '7 days'
          AND NOT EXISTS (SELECT 1 FROM amb_acm_ama_notification_forward f WHERE f.nob_id = o.nob_id)
        GROUP BY o.nob_id, o.ent_id, o.nob_type, o.nob_target_id, o.nob_payload
       ON CONFLICT DO NOTHING
       RETURNING anf_id`,
    );
    return rows.length;
  }

  async sendPending(
    limit: number,
  ): Promise<{ sent: number; retry: number; failed: number }> {
    const rows: ForwardRow[] = await this.ds.query(
      `SELECT f.anf_id, f.ent_id, f.anf_type, f.anf_target_id, f.anf_payload, f.anf_recipients,
              f.anf_dedupe_key, f.anf_attempts, c.amc_ama_entity_id AS ama_entity_id, c.amc_app_code AS app_code
         FROM amb_acm_ama_notification_forward f
         JOIN amb_acm_ama_config c ON c.ent_id = f.ent_id
        WHERE f.anf_status = 'PENDING'
          AND (f.anf_next_attempt_at IS NULL OR f.anf_next_attempt_at <= now())
        ORDER BY f.created_at
        LIMIT $1`,
      [limit],
    );
    let sent = 0;
    let retry = 0;
    let failed = 0;
    for (const row of rows) {
      const outcome = await this.sendOne(row);
      if (outcome === 'SENT') sent++;
      else if (outcome === 'RETRY') retry++;
      else failed++;
    }
    return { sent, retry, failed };
  }

  private async sendOne(row: ForwardRow): Promise<'SENT' | 'RETRY' | 'FAILED'> {
    const { title, body } = renderForward(
      this.locale,
      row.anf_type,
      row.anf_payload ?? {},
    );
    const link = forwardLink(
      this.publicUrl,
      forwardHref(row.anf_type, row.anf_target_id, row.anf_payload ?? {}),
    );
    const attempts = Number(row.anf_attempts) + 1;
    try {
      const res = await this.client.send({
        entityId: row.ama_entity_id,
        appCode: row.app_code,
        dedupeKey: row.anf_dedupe_key,
        title,
        body,
        link,
        recipientUserIds: row.anf_recipients ?? [],
        priority: row.anf_type === 'CSL_CREATED' ? 'high' : 'normal',
      });
      await this.ds.query(
        `UPDATE amb_acm_ama_notification_forward
            SET anf_status='SENT', anf_attempts=$2, anf_sent_at=now(), anf_response=$3::jsonb, anf_error=NULL
          WHERE anf_id=$1`,
        [row.anf_id, attempts, JSON.stringify(res)],
      );
      return 'SENT';
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      const transient =
        e instanceof AmaOpenNotificationUnavailableException ||
        !(e instanceof AmaOpenNotificationRejectedException);
      if (transient && attempts < MAX_ATTEMPTS) {
        const delayMin = 2 ** attempts;
        await this.ds.query(
          `UPDATE amb_acm_ama_notification_forward
              SET anf_attempts=$2, anf_error=$3, anf_next_attempt_at = now() + ($4 || ' minutes')::interval
            WHERE anf_id=$1`,
          [row.anf_id, attempts, msg, String(delayMin)],
        );
        this.log.warn(
          `ama forward retry anf=${row.anf_id} attempt=${attempts}: ${msg}`,
        );
        return 'RETRY';
      }
      await this.ds.query(
        `UPDATE amb_acm_ama_notification_forward
            SET anf_status='FAILED', anf_attempts=$2, anf_error=$3
          WHERE anf_id=$1`,
        [row.anf_id, attempts, msg],
      );
      this.log.warn(`ama forward FAILED anf=${row.anf_id}: ${msg}`);
      return 'FAILED';
    }
  }

  // ── 운영 가시성 / 테스트 ──────────────────────────────────────────────

  async status(entId: string): Promise<{
    counts: Record<'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED', number>;
    lastSentAt: string | null;
    lastError: string | null;
    amaLinkedUsers: number;
    recent: Array<{
      id: string;
      type: string;
      status: string;
      attempts: number;
      recipients: number;
      error: string | null;
      sentAt: string | null;
      createdAt: string;
    }>;
  }> {
    const counts: Array<{ anf_status: string; n: string }> =
      await this.ds.query(
        `SELECT anf_status, count(*)::text AS n FROM amb_acm_ama_notification_forward
        WHERE ent_id=$1 AND created_at > now() - interval '7 days' GROUP BY 1`,
        [entId],
      );
    const last: Array<{ last_sent: string | null; last_error: string | null }> =
      await this.ds.query(
        `SELECT max(anf_sent_at)::text AS last_sent,
                (SELECT anf_error FROM amb_acm_ama_notification_forward
                  WHERE ent_id=$1 AND anf_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1) AS last_error
           FROM amb_acm_ama_notification_forward WHERE ent_id=$1`,
        [entId],
      );
    const users: Array<{ n: string }> = await this.ds.query(
      `SELECT count(*)::text AS n FROM amb_acm_user WHERE ent_id=$1 AND ama_user_id IS NOT NULL AND usr_status='ACTIVE'`,
      [entId],
    );
    const recent: Array<{
      anf_id: string;
      anf_type: string;
      anf_status: string;
      anf_attempts: number;
      recipients: number;
      anf_error: string | null;
      anf_sent_at: string | null;
      created_at: string;
    }> = await this.ds.query(
      `SELECT anf_id, anf_type, anf_status, anf_attempts, jsonb_array_length(anf_recipients) AS recipients,
              anf_error, anf_sent_at::text, created_at::text
         FROM amb_acm_ama_notification_forward WHERE ent_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [entId],
    );
    const out = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 } as Record<
      'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED',
      number
    >;
    for (const c of counts) out[c.anf_status as keyof typeof out] = Number(c.n);
    return {
      counts: out,
      lastSentAt: last[0]?.last_sent ?? null,
      lastError: last[0]?.last_error ?? null,
      amaLinkedUsers: Number(users[0]?.n ?? 0),
      recent: recent.map((r) => ({
        id: r.anf_id,
        type: r.anf_type,
        status: r.anf_status,
        attempts: Number(r.anf_attempts),
        recipients: Number(r.recipients),
        error: r.anf_error,
        sentAt: r.anf_sent_at,
        createdAt: r.created_at,
      })),
    };
  }

  /** 현재 사용자에게 테스트 알림 1건 즉시 전송 (설정 화면 [테스트 전송]). */
  async sendTest(
    entId: string,
    userId: string,
  ): Promise<{ created: number; skipped: number }> {
    const cfg: Array<{
      ama_entity_id: string;
      app_code: string;
      ama_user_id: string | null;
    }> = await this.ds.query(
      `SELECT c.amc_ama_entity_id AS ama_entity_id, c.amc_app_code AS app_code, u.ama_user_id
           FROM amb_acm_ama_config c
           LEFT JOIN amb_acm_user u ON u.usr_id = $2 AND u.ent_id = c.ent_id
          WHERE c.ent_id = $1`,
      [entId, userId],
    );
    if (!cfg[0]) throw new BadRequestException('AMA_CONFIG_NOT_SET');
    if (!cfg[0].ama_user_id) throw new BadRequestException('NO_AMA_USER_ID');
    const { title, body } = renderForward(this.locale, 'CSL_CREATED', {
      seqNo: 'TEST',
    });
    try {
      const res = await this.client.send({
        entityId: cfg[0].ama_entity_id,
        appCode: cfg[0].app_code,
        dedupeKey: `acm:test:${userId}:${Date.now()}`,
        title: `${title} (test)`,
        body,
        link: forwardLink(this.publicUrl, '/admin/dashboard'),
        recipientUserIds: [cfg[0].ama_user_id],
      });
      return { created: res.created, skipped: res.skipped };
    } catch (e) {
      throw new BadRequestException(
        `AMA_FORWARD_TEST_FAILED: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`,
      );
    }
  }
}
