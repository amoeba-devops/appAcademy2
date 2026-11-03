import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { FORWARD_TYPES } from './ama-forward-templates';
import {
  NOTIFY_SPEC,
  NOTIFY_TYPES,
  normalizePersonal,
  normalizeTenant,
  type NotifyType,
  type PersonalPrefs,
  type TenantNotifyConfig,
} from './notification-catalog';
import type { InboxActor } from './inbox.service';

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/** 트랜잭션 안(enqueueInbox)에서도 쓰는 읽기 — 외부 I/O 없음. */
export async function loadTenantConfig(
  q: Queryable,
  entId: string,
): Promise<TenantNotifyConfig> {
  const rows = (await q.query(
    'SELECT nst_config AS config FROM amb_acm_notification_setting WHERE ent_id=$1',
    [entId],
  )) as { config: unknown }[];
  return normalizeTenant(rows[0]?.config);
}
export async function loadPersonal(
  q: Queryable,
  entId: string,
  kind: 'USER' | 'TEACHER',
  id: string,
): Promise<PersonalPrefs> {
  const rows = (await q.query(
    'SELECT npf_config AS config FROM amb_acm_notification_pref WHERE ent_id=$1 AND npf_kind=$2 AND npf_recipient_id=$3',
    [entId, kind, id],
  )) as { config: unknown }[];
  return normalizePersonal(rows[0]?.config);
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** 저장 요청은 엄격히 검사한다(읽기는 normalize 가 기본값으로 메움). */
function assertTenantInput(raw: unknown) {
  const bad = () => new BadRequestException('INVALID_NOTIFICATION_SETTINGS');
  if (!isObj(raw)) throw bad();
  const rem = raw.reminder;
  if (rem !== undefined) {
    if (!isObj(rem)) throw bad();
    const { first, second } = rem;
    for (const h of [first, second])
      if (!Number.isInteger(h) || (h as number) < 1 || (h as number) > 48)
        throw new BadRequestException('INVALID_REMINDER_HOURS');
    if ((second as number) <= (first as number))
      throw new BadRequestException('INVALID_REMINDER_HOURS');
  }
  const push = raw.push;
  if (push !== undefined) {
    if (!isObj(push)) throw bad();
    assertQuiet(push.quiet);
  }
  if (raw.types !== undefined && !isObj(raw.types)) throw bad();
  if (
    raw.ama !== undefined &&
    (!Array.isArray(raw.ama) ||
      raw.ama.some((x) => !(FORWARD_TYPES as readonly unknown[]).includes(x)))
  )
    throw bad();
}
function assertQuiet(q: unknown) {
  if (q === undefined) return;
  if (
    !isObj(q) ||
    typeof q.on !== 'boolean' ||
    typeof q.start !== 'string' ||
    typeof q.end !== 'string' ||
    !HHMM.test(q.start) ||
    !HHMM.test(q.end)
  )
    throw new BadRequestException('INVALID_QUIET_HOURS');
}

/** REQ-261102B — 알림 설정(학원·개인)과 기기 푸시 현황. */
@Injectable()
export class NotificationSettingsService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  private async ama(entId: string) {
    const rows: { enabled: boolean; types: string }[] = await this.ds.query(
      `SELECT (amc_is_active AND amc_forward_enabled) AS enabled, amc_forward_types AS types
       FROM amb_acm_ama_config WHERE ent_id=$1 ORDER BY amc_is_active DESC LIMIT 1`,
      [entId],
    );
    const row = rows[0];
    return {
      connected: !!row,
      enabled: !!row?.enabled,
      types: row
        ? row.types
            .split(',')
            .map((s) => s.trim())
            .filter((s) => (FORWARD_TYPES as readonly string[]).includes(s))
        : [],
      supported: [...FORWARD_TYPES],
    };
  }

  async getTenant(entId: string) {
    return {
      config: await loadTenantConfig(this.ds, entId),
      spec: NOTIFY_SPEC,
      types: NOTIFY_TYPES,
      ama: await this.ama(entId),
    };
  }

  async putTenant(entId: string, actorId: string, raw: unknown) {
    assertTenantInput(raw);
    const body = raw as Record<string, unknown>;
    const config = normalizeTenant(body);
    await this.ds.transaction(async (m) => {
      await m.query(
        `INSERT INTO amb_acm_notification_setting(ent_id,nst_config,nst_updated_by) VALUES($1,$2,$3)
         ON CONFLICT(ent_id) DO UPDATE SET nst_config=excluded.nst_config,nst_updated_by=excluded.nst_updated_by,updated_at=now()`,
        [entId, config, actorId],
      );
      // AMA 열 = AMA 설정의 '전달 종류'(값 하나로 유지)
      if (Array.isArray(body.ama))
        await m.query(
          `UPDATE amb_acm_ama_config SET amc_forward_types=$2 WHERE ent_id=$1`,
          [entId, (body.ama as string[]).join(',')],
        );
    });
    return this.getTenant(entId);
  }

  /** 메일·알림톡 같은 직접 발송 경로가 켜져 있는지. */
  async channels(entId: string, type: NotifyType) {
    const t = (await loadTenantConfig(this.ds, entId)).types[type];
    return { mail: t.mail, alimtalk: t.alimtalk };
  }

  async getPersonal(u: InboxActor) {
    const kind = u.kind ?? 'USER';
    const tenant = await loadTenantConfig(this.ds, u.entId);
    return {
      prefs: await loadPersonal(this.ds, u.entId, kind, u.id),
      tenant: {
        types: tenant.types,
        pushEnabled: tenant.push.enabled,
        quiet: tenant.push.quiet,
      },
      spec: NOTIFY_SPEC,
      types: this.personalTypes(kind),
    };
  }

  /** 개인 설정에 보일 상황 — 메일·알림톡만 있는 상황, 포털 강사가 받지 않는 상황 제외. */
  private personalTypes(kind: 'USER' | 'TEACHER') {
    const teacher = ['REVIEW_OVERDUE', 'CHAT_MESSAGE', 'CHAT_MENTION'];
    return NOTIFY_TYPES.filter(
      (t) =>
        NOTIFY_SPEC[t].channels.includes('inbox') &&
        (kind === 'USER' || teacher.includes(t)),
    );
  }

  async putPersonal(u: InboxActor, raw: unknown) {
    if (!isObj(raw))
      throw new BadRequestException('INVALID_NOTIFICATION_SETTINGS');
    assertQuiet(raw.quiet);
    const prefs = normalizePersonal(raw);
    await this.ds.query(
      `INSERT INTO amb_acm_notification_pref(ent_id,npf_kind,npf_recipient_id,npf_config) VALUES($1,$2,$3,$4)
       ON CONFLICT(ent_id,npf_kind,npf_recipient_id) DO UPDATE SET npf_config=excluded.npf_config,updated_at=now()`,
      [u.entId, u.kind ?? 'USER', u.id, prefs],
    );
    return this.getPersonal(u);
  }

  /** 기기 현황 — 최근 30일 갱신된 구독(푸시 발송 대상과 같은 기준), 최근 7일 발송 결과. */
  async pushStatus(entId: string) {
    const devices: { device: string | null; n: number }[] = await this.ds.query(
      `SELECT psu_device AS device, count(*)::int AS n FROM amb_acm_push_subscription
       WHERE ent_id=$1 AND updated_at>now()-interval '30 days' GROUP BY psu_device`,
      [entId],
    );
    const results: { result: string | null; n: number }[] = await this.ds.query(
      `SELECT pdl_result AS result, count(*)::int AS n FROM amb_acm_push_delivery
       WHERE ent_id=$1 AND pdl_done_at>now()-interval '7 days' GROUP BY pdl_result`,
      [entId],
    );
    const count = <T extends { n: number }>(rows: T[], f: (r: T) => boolean) =>
      rows.filter(f).reduce((s, r) => s + r.n, 0);
    return {
      devices: {
        mobile: count(devices, (r) => r.device === 'MOBILE'),
        desktop: count(devices, (r) => r.device === 'DESKTOP'),
        unknown: count(devices, (r) => !r.device),
      },
      last7days: {
        sent: count(results, (r) => r.result === 'SENT'),
        failed: count(results, (r) => r.result === 'FAILED'),
        skipped: count(results, (r) => r.result === 'SKIPPED' || !r.result),
      },
    };
  }
}
