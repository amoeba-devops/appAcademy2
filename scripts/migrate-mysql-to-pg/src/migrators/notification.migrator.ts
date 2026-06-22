import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * Notification — 2 tables (REQ-260622 §2.3).
 *
 *   tac_notification_templates → amb_acm_notification_template
 *   tac_notification_logs      → amb_acm_notification_log
 *
 * Templates depend only on tenant. Logs depend on tenant + may reference a
 * template via `code` (FK by business code, not UUID — preserved as text
 * for legacy reasons).
 */
export class NotificationMigrator extends BaseMigrator {
  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('notification', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const tables: MigrateResult['tables'] = [];
    tables.push(await this.migrateTemplates(opts));
    tables.push(await this.migrateLogs(opts));
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_notification_templates', 'amb_acm_notification_template'],
      ['tac_notification_logs',      'amb_acm_notification_log'],
    ]);
  }

  private migrateTemplates(opts: MigrateOptions) {
    return this.migrateTable<{
      ntp_id: number;
      acd_id: number;
      ntp_code: string;
      ntp_channel: string;
      ntp_locale: string | null;
      ntp_subject: string | null;
      ntp_body_text: string | null;
      ntp_body_html: string | null;
      ntp_is_active: number;
    }>({
      mysqlTable: 'tac_notification_templates',
      pgTable: 'amb_acm_notification_template',
      orderBy: 'ntp_id',
      columns: [
        'legacy_id', 'ent_id', 'ntp_code', 'ntp_channel', 'ntp_locale',
        'ntp_subject', 'ntp_body_text', 'ntp_body_html', 'ntp_is_active',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.ntp_id,
          ent_id: entId,
          ntp_code: r.ntp_code,
          ntp_channel: r.ntp_channel,
          ntp_locale: r.ntp_locale ?? 'ko',
          ntp_subject: r.ntp_subject,
          ntp_body_text: r.ntp_body_text,
          ntp_body_html: r.ntp_body_html,
          ntp_is_active: this.toBoolean(r.ntp_is_active),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }

  private migrateLogs(opts: MigrateOptions) {
    return this.migrateTable<{
      ntl_id: number;
      acd_id: number;
      ntp_code: string | null;
      ntl_channel: string;
      ntl_recipient_kind: string | null;
      ntl_to_address: string | null;
      ntl_subject: string | null;
      ntl_body_summary: string | null;
      ntl_status: string;
      ntl_error: string | null;
      ntl_sent_at: Date | string | null;
      ntl_created_at: Date | string;
    }>({
      mysqlTable: 'tac_notification_logs',
      pgTable: 'amb_acm_notification_log',
      orderBy: 'ntl_id',
      columns: [
        'legacy_id', 'ent_id', 'ntp_code', 'ntl_channel', 'ntl_recipient_kind',
        'ntl_to_address', 'ntl_subject', 'ntl_body_summary', 'ntl_status',
        'ntl_error', 'ntl_sent_at', 'created_at',
      ],
      mapRow: (r) => {
        const entId = this.tenants.resolve(r.acd_id);
        if (!entId) return null;
        return {
          legacy_id: r.ntl_id,
          ent_id: entId,
          ntp_code: r.ntp_code,
          ntl_channel: r.ntl_channel,
          ntl_recipient_kind: r.ntl_recipient_kind,
          ntl_to_address: r.ntl_to_address,
          ntl_subject: r.ntl_subject,
          ntl_body_summary: r.ntl_body_summary,
          ntl_status: r.ntl_status,
          ntl_error: r.ntl_error,
          ntl_sent_at: this.toTimestampTz(r.ntl_sent_at),
          created_at: this.toTimestampTz(r.ntl_created_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });
  }
}
