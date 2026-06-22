import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SubscriptionEventType =
  | 'SUBSCRIPTION_CREATED'
  | 'ACTIVATED'
  | 'SUSPENDED'
  | 'RESUMED'
  | 'CANCELED'
  | 'PLAN_CHANGED';

/**
 * AMA App Store subscription lifecycle webhook ledger.
 *
 * `sub_nonce` UNIQUE 가 AMA 측 idempotency 계약과 직결 — same nonce =
 * duplicate webhook = silently dropped. Audit + reconciliation source
 * of truth for tenant provisioning / suspension.
 *
 * @see sql/acm/980-acm-subscription-event.sql
 */
@Entity('amb_acm_subscription_event')
@Index('uq_acm_subscription_event_nonce', ['nonce'], { unique: true })
@Index('idx_acm_subscription_event_ent', ['entId', 'eventAt'])
@Index('idx_acm_subscription_event_ama_tenant', ['amaTenantId', 'eventAt'])
@Index('idx_acm_subscription_event_type_at', ['eventType', 'eventAt'])
export class SubscriptionEventTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'sub_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  /** Nullable — provisioning 이전 이벤트는 ent_id 없을 수 있음. */
  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId?: string | null;

  @Column({ name: 'sub_ama_tenant_id', type: 'varchar', length: 64 })
  amaTenantId!: string;

  @Column({ name: 'sub_event_type', type: 'varchar', length: 40 })
  eventType!: SubscriptionEventType;

  @Column({ name: 'sub_plan', type: 'varchar', length: 60, nullable: true })
  plan?: string | null;

  /** X-AMA-Nonce header — 멱등성 계약. */
  @Column({ name: 'sub_nonce', type: 'varchar', length: 64 })
  nonce!: string;

  /** X-AMA-Signature (HMAC-SHA256) — 감사용으로 그대로 보관. */
  @Column({ name: 'sub_signature', type: 'varchar', length: 128 })
  signature!: string;

  @Column({ name: 'sub_event_at', type: 'timestamptz' })
  eventAt!: Date;

  @Column({ name: 'sub_payload', type: 'jsonb' })
  payload!: unknown;

  @Column({ name: 'sub_processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ name: 'sub_processing_error', type: 'text', nullable: true })
  processingError?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
