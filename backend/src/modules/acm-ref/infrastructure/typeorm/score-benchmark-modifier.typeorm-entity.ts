import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SbfModifierType = 'FOREIGN_SCHOOL' | 'INTERNATIONAL_BOARDING' | 'OTHER';
export type SbfUnit = 'POINTS' | 'PERCENTILE';

@Entity('amb_acm_ref_score_benchmark_modifiers')
@Index('idx_acm_ref_sbf_ent_type', ['entId', 'modifierType'])
export class ScoreBenchmarkModifierTypeormEntity {
  @PrimaryColumn({ name: 'sbf_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'sbm_id', type: 'uuid', nullable: true })
  sbmId?: string | null;

  @Column({ name: 'sbf_modifier_type', type: 'varchar', length: 30 })
  modifierType!: SbfModifierType;

  @Column({ name: 'sbf_adjustment_min', type: 'numeric', precision: 5, scale: 1 })
  adjustmentMin!: string;

  @Column({ name: 'sbf_adjustment_max', type: 'numeric', precision: 5, scale: 1 })
  adjustmentMax!: string;

  @Column({ name: 'sbf_unit', type: 'varchar', length: 20, default: 'POINTS' })
  unit!: SbfUnit;

  @Column({ name: 'sbf_description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'sbf_effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'sbf_effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @CreateDateColumn({ name: 'sbf_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'sbf_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
