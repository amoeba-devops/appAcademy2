import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';
import { IdMap } from '../lib/id-map';

/**
 * Class-enrollment migrator (REQ-260622 model decision X).
 *
 * Migrates MySQL `tac_enrollments` (student × class join with status) to
 * the new PG table `amb_acm_cls_enrollment`. Distinct from
 * `amb_acm_csl_enrollment` which is a consultation pipeline marker — see
 * sql/acm/952 for the model split rationale.
 *
 * Runs AFTER `backfill-legacy-id` so that:
 *   - cls_classes.legacy_id is populated (resolves tac_enrollments.cls_id)
 *   - std_student.legacy_id is populated (resolves tac_enrollments.std_id)
 *
 * And AFTER std_parent backfill (T3) for `applied_prt_id` — but since
 * std_parent T3 isn't auto-implemented, this migrator skips orphaned
 * enrollments and counts them under pgSkipped. Operator decides whether
 * to manually backfill std_parent first or to NULL-tolerate applied_prt_id
 * (would require ALTER on amb_acm_cls_enrollment first).
 */
export class ClsEnrollmentMigrator extends BaseMigrator {
  private classMap?: IdMap;
  private studentMap?: IdMap;
  private parentMap?: IdMap;

  private get cls(): IdMap {
    if (!this.classMap) this.classMap = new IdMap(this.pg, 'amb_acm_cls_classes', 'cls_id');
    return this.classMap;
  }
  private get std(): IdMap {
    if (!this.studentMap) this.studentMap = new IdMap(this.pg, 'amb_acm_std_student', 'std_id');
    return this.studentMap;
  }
  private get prt(): IdMap {
    if (!this.parentMap) this.parentMap = new IdMap(this.pg, 'amb_acm_std_parent', 'prt_id');
    return this.parentMap;
  }

  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('cls-enrollment', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    type Row = {
      enr_id: number;
      acd_id: number;
      cls_id: number;
      std_id: number;
      enr_applied_prt_id: number;
      enr_status: string;
      enr_applied_at: Date | string;
      enr_confirmed_at: Date | string | null;
      enr_canceled_at: Date | string | null;
    };

    const table = await this.migrateTable<Row, {
      cls: Map<number, string>;
      std: Map<number, string>;
      prt: Map<number, string>;
    }>({
      mysqlTable: 'tac_enrollments',
      pgTable: 'amb_acm_cls_enrollment',
      orderBy: 'enr_id',
      columns: [
        'legacy_id', 'ent_id', 'cls_id', 'std_id', 'ce_applied_prt_id',
        'ce_status', 'ce_applied_at', 'ce_confirmed_at', 'ce_canceled_at',
      ],
      preBatch: async (batch) => {
        const cls = await this.cls.resolveMany(batch.map((r) => r.cls_id));
        const std = await this.std.resolveMany(batch.map((r) => r.std_id));
        const prt = await this.prt.resolveMany(batch.map((r) => r.enr_applied_prt_id));
        return { cls, std, prt };
      },
      mapRow: (r, ctx) => {
        const entId = this.tenants.resolve(r.acd_id);
        const cls_id = ctx.cls.get(Number(r.cls_id));
        const std_id = ctx.std.get(Number(r.std_id));
        const prt_id = ctx.prt.get(Number(r.enr_applied_prt_id));
        if (!entId || !cls_id || !std_id || !prt_id) {
          this.log.warn(`skip enrollment ${r.enr_id}`, {
            tenantOk: !!entId, classOk: !!cls_id, studentOk: !!std_id, parentOk: !!prt_id,
            acd_id: r.acd_id, cls_id: r.cls_id, std_id: r.std_id, prt_id: r.enr_applied_prt_id,
          });
          return null;
        }
        return {
          legacy_id: r.enr_id,
          ent_id: entId,
          cls_id,
          std_id,
          ce_applied_prt_id: prt_id,
          ce_status: r.enr_status,
          ce_applied_at: this.toTimestampTz(r.enr_applied_at),
          ce_confirmed_at: this.toTimestampTz(r.enr_confirmed_at),
          ce_canceled_at: this.toTimestampTz(r.enr_canceled_at),
        };
      },
      onConflict: 'legacy_id',
      opts,
    });

    return { domain: this.domain, tables: [table] };
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_enrollments', 'amb_acm_cls_enrollment'],
    ]);
  }
}
