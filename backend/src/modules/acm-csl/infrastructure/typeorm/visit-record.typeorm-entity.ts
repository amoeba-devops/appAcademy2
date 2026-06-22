import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InquiryTypeormEntity } from './inquiry.typeorm-entity';

export type VisitOutcome = 'SCHEDULED' | 'VISITED' | 'CANCELED' | 'NO_SHOW';

/** @see sql/acm/975-acm-csl-aux.sql §1 — 상담 후속 방문/통화 이력 */
@Entity('amb_acm_csl_visit_record')
@Index('idx_acm_csl_visit_record_inq', ['inquiryId', 'scheduledAt'])
export class VisitRecordTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'vsr_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inquiryId!: string;

  @ManyToOne(() => InquiryTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inq_id', referencedColumnName: 'id' })
  inquiry?: InquiryTypeormEntity;

  @Column({ name: 'vsr_scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'vsr_visited_at', type: 'timestamptz', nullable: true })
  visitedAt?: Date | null;

  @Column({ name: 'vsr_outcome', type: 'varchar', length: 20, nullable: true })
  outcome?: VisitOutcome | null;

  @Column({ name: 'vsr_handler_user_id', type: 'uuid', nullable: true })
  handlerUserId?: string | null;

  @Column({ name: 'vsr_memo', type: 'text', nullable: true })
  memo?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
