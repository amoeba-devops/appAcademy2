import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * PLN-260914B — per-site daily KPI (MARKETING + CS only).
 * (ent_id, site, date) unique; site ∈ TPI | TRINITY | SANTACROCE | COMMON.
 * Tenant totals stay in amb_acm_dsh_daily_kpi.
 */
@Entity('amb_acm_dsh_daily_kpi_site')
@Index('uq_acm_dsh_dks', ['entId', 'site', 'date'], { unique: true })
export class DailyKpiSiteTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'dks_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'dks_site', type: 'varchar', length: 20 })
  site!: string;

  @Column({ name: 'dks_date', type: 'date' })
  date!: string;

  @Column({ name: 'dks_year_month', type: 'varchar', length: 7 })
  yearMonth!: string;

  @Column({ name: 'dks_marketing_visitor', type: 'int', nullable: true })
  marketingVisitor?: number | null;

  @Column({
    name: 'dks_marketing_cost',
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
  })
  marketingCost?: string | null;

  @Column({ name: 'dks_marketing_effect', type: 'int', nullable: true })
  marketingEffect?: number | null;

  @Column({ name: 'dks_cs_counseling', type: 'int', default: 0 })
  csCounseling!: number;

  @Column({ name: 'dks_cs_apply', type: 'int', default: 0 })
  csApply!: number;

  @Column({ name: 'dks_cs_beginning', type: 'int', default: 0 })
  csBeginning!: number;

  @Column({ name: 'dks_cs_missing', type: 'int', default: 0 })
  csMissing!: number;

  @Column({ name: 'dks_cs_trial_class', type: 'int', default: 0 })
  csTrialClass!: number;

  @Column({ name: 'dks_cs_complain', type: 'int', default: 0 })
  csComplain!: number;

  @Column({
    name: 'dks_computed_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  computedAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
