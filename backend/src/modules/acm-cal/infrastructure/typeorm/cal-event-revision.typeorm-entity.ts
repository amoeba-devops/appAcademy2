import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 변경 요약 1건 — 필드명 + 이전/이후 값(사람이 읽는 문자열). */
export interface CalEventChange {
  field: string;
  before: string | null;
  after: string | null;
}

/**
 * REQ-260728 — 수업일정 수정 히스토리(append-only). 사용자 수정마다 1행 기록.
 * 시스템 자동수정(BODA 프로비저닝 등)은 기록하지 않는다.
 *
 * @see docs/plan/PLN-260728-acm-cal-event-delete-edit-audit.md
 */
@Entity('amb_acm_cal_event_revision')
@Index('idx_acm_cal_evt_rev_evt', ['evtId', 'createdAt'])
export class CalEventRevisionTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'rev_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_id', type: 'uuid' })
  evtId!: string;

  @Column({ name: 'rev_editor_user_id', type: 'uuid', nullable: true })
  editorUserId?: string | null;

  @Column({ name: 'rev_reason', type: 'varchar', length: 500, nullable: true })
  reason?: string | null;

  @Column({ name: 'rev_changes', type: 'jsonb', default: () => "'[]'" })
  changes!: CalEventChange[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
