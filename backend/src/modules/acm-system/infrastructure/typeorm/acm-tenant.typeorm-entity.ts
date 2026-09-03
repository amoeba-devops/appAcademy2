import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** REQ-260621 v1.1 — ACM tenant registry (amb_acm_tenant). */
@Entity('amb_acm_tenant')
export class AcmTenantTypeormEntity {
  @PrimaryColumn({ name: 'tnt_ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tnt_name', type: 'varchar', length: 200 })
  name!: string;

  /** PLN-260708 — short login code (slug) for portal tenant-scoped login. */
  @Column({ name: 'tnt_code', type: 'varchar', length: 40, nullable: true })
  code?: string | null;

  @Column({ name: 'tnt_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';

  /** REQ-260903 — 테넌트 타임존 (IANA). 모든 일정 표시·입력 기준. */
  @Column({ name: 'tnt_timezone', type: 'varchar', length: 64, default: 'Asia/Seoul' })
  timezone!: string;

  @Column({ name: 'tnt_is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'tnt_ama_entity_id', type: 'varchar', length: 80, nullable: true })
  amaEntityId?: string | null;

  @Column({ name: 'tnt_ama_entity_code', type: 'varchar', length: 40, nullable: true })
  amaEntityCode?: string | null;

  @Column({ name: 'tnt_subscription_status', type: 'varchar', length: 30, default: 'ACTIVE' })
  subscriptionStatus!: string;

  @Column({ name: 'tnt_subscription_plan', type: 'varchar', length: 80, nullable: true })
  subscriptionPlan?: string | null;

  @Column({ name: 'tnt_canceled_at', type: 'timestamptz', nullable: true })
  canceledAt?: Date | null;

  @Column({ name: 'tnt_deprovisioned_at', type: 'timestamptz', nullable: true })
  deprovisionedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
