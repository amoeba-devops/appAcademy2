import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PLN-260728F B — 수업(이벤트) 피드백·과제.
 * evt 당 1행(UNIQUE). 수업완료 = feedbackHtml 존재 AND homeworkStatus 입력.
 */
export type CalHomeworkStatus = 'ASSIGNED' | 'NONE';

@Entity('amb_acm_cal_event_review')
@Index('uq_acm_cal_review_evt', ['entId', 'evtId'], { unique: true })
export class CalEventReviewTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'rvw_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_id', type: 'uuid' })
  evtId!: string;

  /** 강사 피드백 (rich HTML, 렌더 시 sanitize). */
  @Column({ name: 'rvw_feedback_html', type: 'text', nullable: true })
  feedbackHtml?: string | null;

  @Column({
    name: 'rvw_homework_status',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  homeworkStatus?: CalHomeworkStatus | null;

  /** 과제 내용 (rich HTML). homeworkStatus=NONE 이면 무시. */
  @Column({ name: 'rvw_homework_html', type: 'text', nullable: true })
  homeworkHtml?: string | null;

  @Column({ name: 'rvw_author_tch_id', type: 'uuid', nullable: true })
  authorTchId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
