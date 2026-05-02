import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type QnaStatus = 'OPEN' | 'RESPONDED' | 'RESOLVED' | 'ESCALATED' | 'DEFERRED';
export type QnaResolutionStatus = 'CONFIRMED_RESOLVED' | 'UNCONFIRMED' | 'UNSATISFIED' | 'NA';
export type QnaResponseStatus = 'DRAFT' | 'INTERNAL_ONLY' | 'EXTERNAL_READY' | 'DELIVERED';
export type QnaFaqVisibility = 'ADVISOR_ONLY' | 'ALL_USER' | 'INCLUDE_TEACHER';

@Entity('amb_acm_qna_question')
@Index('idx_acm_qna_ent_status', ['entId', 'status'])
@Index('idx_acm_qna_ent_student', ['entId', 'studentId'])
export class QuestionTypeormEntity {
  @PrimaryColumn({ name: 'qna_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId?: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @Column({ name: 'subject', type: 'varchar', length: 200 })
  subject!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  /** Internal-only analyst notes (not exposed to parent) */
  @Column({ name: 'internal_body', type: 'text', nullable: true })
  internalBody?: string | null;

  /** Parent-facing response */
  @Column({ name: 'external_body', type: 'text', nullable: true })
  externalBody?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'OPEN' })
  status!: QnaStatus;

  @Column({ name: 'resolution_status', type: 'varchar', length: 20, default: 'NA' })
  resolutionStatus!: QnaResolutionStatus;

  @Column({ name: 'response_status', type: 'varchar', length: 20, default: 'DRAFT' })
  responseStatus!: QnaResponseStatus;

  @Column({ name: 'tags', type: 'jsonb', nullable: true })
  tags?: string[] | null;

  @Column({ name: 'is_faq_promoted', type: 'boolean', default: false })
  isFaqPromoted!: boolean;

  @Column({ name: 'faq_visibility', type: 'varchar', length: 20, default: 'ADVISOR_ONLY' })
  faqVisibility!: QnaFaqVisibility;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ name: 'escalated_at', type: 'timestamptz', nullable: true })
  escalatedAt?: Date | null;

  @Column({ name: 'escalated_by', type: 'uuid', nullable: true })
  escalatedBy?: string | null;

  /** Self-FK to parent QNA in the thread chain (Q-09/Q-10). Distinct from parentId (= parent user FK). */
  @Column({ name: 'thread_parent_id', type: 'uuid', nullable: true })
  threadParentId?: string | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string | null;

  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
