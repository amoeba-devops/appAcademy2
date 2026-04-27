import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';

/**
 * tac_subscription_events — AMA 구독 lifecycle webhook ledger.
 * - 멱등성: sub_nonce 가 unique → 동일 nonce 두 번째 호출은 409.
 * - 감사: 모든 이벤트는 처리 결과 + 원본 payload 보존.
 */
@Entity('tac_subscription_events')
@Unique('uq_tac_subscription_events_nonce', ['subNonce'])
@Index('idx_tac_subscription_events_acd', ['acdId'])
@Index('idx_tac_subscription_events_ama_tenant', ['subAmaTenantId'])
@Index('idx_tac_subscription_events_type_at', ['subEventType', 'subEventAt'])
export class SubscriptionEventEntity {
  @PrimaryGeneratedColumn({ name: 'sub_id', type: 'bigint', unsigned: true })
  subId: number;

  /** provisioning 이전 이벤트는 NULL */
  @Column({ name: 'acd_id', type: 'bigint', unsigned: true, nullable: true })
  acdId: number | null;

  @Column({ name: 'sub_ama_tenant_id', type: 'varchar', length: 64 })
  subAmaTenantId: string;

  /** SUBSCRIPTION_CREATED/ACTIVATED/SUSPENDED/RESUMED/CANCELED/PLAN_CHANGED */
  @Column({ name: 'sub_event_type', type: 'varchar', length: 40 })
  subEventType: string;

  @Column({ name: 'sub_plan', type: 'varchar', length: 60, nullable: true })
  subPlan: string | null;

  @Column({ name: 'sub_nonce', type: 'varchar', length: 64 })
  subNonce: string;

  @Column({ name: 'sub_signature', type: 'varchar', length: 128 })
  subSignature: string;

  @Column({ name: 'sub_event_at', type: 'datetime' })
  subEventAt: Date;

  @Column({ name: 'sub_payload', type: 'json' })
  subPayload: Record<string, unknown>;

  @Column({ name: 'sub_processed_at', type: 'datetime', nullable: true })
  subProcessedAt: Date | null;

  @Column({ name: 'sub_processing_error', type: 'text', nullable: true })
  subProcessingError: string | null;

  @CreateDateColumn({ name: 'sub_created_at' })
  subCreatedAt: Date;

  @ManyToOne(() => AcademyEntity, { nullable: true })
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity | null;
}
