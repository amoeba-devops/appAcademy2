import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 환불 정책 — 버전 관리 (소급 미적용).
 *
 * @see sql/acm/950-acm-pay-schema.sql §1
 * @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.1.1
 *
 * Tenant guard: 모든 query 는 `ent_id` 필터 필수 (OwnEntityGuard 패턴).
 */
@Entity('amb_acm_pay_refund_policy')
@Index('uq_acm_pay_refund_policy_ent_version', ['entId', 'version'], { unique: true })
export class PayRefundPolicyTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'prp_id' })
  id!: string;

  /** Phase 3 데이터 이전 시 MySQL `rfp_id` 보존. Phase 7 + 30일 후 drop. */
  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'prp_version', type: 'integer' })
  version!: number;

  @Column({ name: 'prp_basis', type: 'varchar', length: 20, default: 'SESSION' })
  basis!: 'SESSION' | 'CALENDAR';

  @Column({ name: 'prp_label', type: 'varchar', length: 100 })
  label!: string;

  @Column({ name: 'prp_effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'prp_effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'prp_is_default_template', type: 'boolean', default: false })
  isDefaultTemplate!: boolean;

  @Column({ name: 'prp_created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
