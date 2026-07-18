import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AttStatus =
  | 'PRESENT'
  | 'ABSENT_EXCUSED'
  | 'ABSENT_UNEXCUSED'
  | 'LATE'
  | 'LEFT_EARLY';

@Entity('amb_acm_cls_attendance')
@Index('idx_acm_cls_att_ses_idx', ['sesId'])
export class AttendanceTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'att_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'ses_id', type: 'uuid' })
  sesId!: string;

  @Column({ name: 'cst_id', type: 'uuid' })
  cstId!: string;

  @Column({
    name: 'att_status',
    type: 'varchar',
    length: 20,
    default: 'PRESENT',
  })
  status!: AttStatus;

  @Column({
    name: 'att_billable_hours',
    type: 'numeric',
    precision: 3,
    scale: 1,
    default: 0,
  })
  billableHours!: string;

  @Column({ name: 'att_recorded_by', type: 'uuid', nullable: true })
  recordedBy?: string | null;

  @Column({ name: 'att_recorded_at', type: 'timestamptz', nullable: true })
  recordedAt?: Date | null;

  @Column({ name: 'att_remark', type: 'text', nullable: true })
  remark?: string | null;

  @Column({ name: 'att_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'att_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
