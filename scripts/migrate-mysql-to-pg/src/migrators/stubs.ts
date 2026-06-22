import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * Stub implementations for the remaining 6 domains. Each one mirrors the
 * structure of `pay.migrator.ts` but the table-by-table `migrateXxx()`
 * methods are TODOs for Phase 3 execution.
 *
 * Why stubs:
 * - Surface the full list of (mysqlTable, pgTable) pairs so verify() can
 *   already report row diffs (useful to validate Phase 1 SQL applied).
 * - Establishes the file/class layout so Phase 3 work is just filling in
 *   the per-table `migrateXxx()` methods.
 */

abstract class StubMigrator extends BaseMigrator {
  abstract tablePairs: Array<[string, string]>;

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    this.log.warn(`${this.domain} migrate() not implemented yet — Phase 3 work`);
    const tables: MigrateResult['tables'] = [];
    for (const [mysqlTable, pgTable] of this.tablePairs) {
      tables.push({
        mysqlTable,
        pgTable,
        mysqlCount: await this.mysql.count(mysqlTable).catch(() => 0),
        pgInserted: 0,
        pgSkipped: 0,
        durationMs: 0,
      });
    }
    return { domain: this.domain, tables };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts(this.tablePairs.map(([m, p]) => [m, p]));
  }
}

export class MapMigrator extends StubMigrator {
  tablePairs: Array<[string, string]> = [
    ['tac_map_passage_assets', 'amb_acm_map_passage_asset'],
    ['tac_map_items',          'amb_acm_map_item'],
    ['tac_map_item_tags',      'amb_acm_map_item_tag'],
    ['tac_map_test_sets',      'amb_acm_map_test_set'],
    ['tac_map_test_set_items', 'amb_acm_map_test_set_item'],
    ['tac_map_assignments',    'amb_acm_map_assignment'],
    ['tac_map_responses',      'amb_acm_map_response'],
    ['tac_map_scores',         'amb_acm_map_score'],
  ];
  constructor(...args: ConstructorParameters<typeof BaseMigrator>) {
    super(args[0] ?? 'map', args[1], args[2], args[3], args[4]);
  }
}

export class NotificationMigrator extends StubMigrator {
  tablePairs: Array<[string, string]> = [
    ['tac_notification_templates', 'amb_acm_notification_template'],
    ['tac_notification_logs',      'amb_acm_notification_log'],
  ];
  constructor(...args: ConstructorParameters<typeof BaseMigrator>) {
    super(args[0] ?? 'notification', args[1], args[2], args[3], args[4]);
  }
}

export class AuditMigrator extends StubMigrator {
  tablePairs: Array<[string, string]> = [
    ['tac_audit_logs', 'amb_acm_audit_log'],
  ];
  constructor(...args: ConstructorParameters<typeof BaseMigrator>) {
    super(args[0] ?? 'audit', args[1], args[2], args[3], args[4]);
  }
  // Phase 3 — override migrate() to apply MIGRATION_AUDIT_CUTOFF_DAYS
  // WHERE clause (default 90d) before iterate().
}

export class PostsMigrator extends StubMigrator {
  tablePairs: Array<[string, string]> = [
    ['tac_posts',             'amb_acm_post'],
    ['tac_programs',          'amb_acm_program'],
    ['tac_program_settings',  'amb_acm_program_setting'],
    ['tac_classrooms',        'amb_acm_classroom'],
  ];
  constructor(...args: ConstructorParameters<typeof BaseMigrator>) {
    super(args[0] ?? 'posts', args[1], args[2], args[3], args[4]);
  }
}

export class CslAuxMigrator extends StubMigrator {
  tablePairs: Array<[string, string]> = [
    ['tac_visit_records',             'amb_acm_csl_visit_record'],
    ['tac_consultation_intake_form',  'amb_acm_csl_intake_form'],
    ['tac_external_test_scores',      'amb_acm_std_external_test_score'],
  ];
  constructor(...args: ConstructorParameters<typeof BaseMigrator>) {
    super(args[0] ?? 'csl-aux', args[1], args[2], args[3], args[4]);
  }
}

export class SubscriptionMigrator extends StubMigrator {
  tablePairs: Array<[string, string]> = [
    ['tac_subscription_events', 'amb_acm_subscription_event'],
  ];
  constructor(...args: ConstructorParameters<typeof BaseMigrator>) {
    super(args[0] ?? 'subscription', args[1], args[2], args[3], args[4]);
  }
}
