import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ScheduleType = 'REGULAR' | 'ROLLING' | 'ED' | 'EA' | 'OTHER';

@Entity('amb_acm_sch_schedule')
@Index('idx_acm_sch_schedule_ent_sch', ['entId', 'schId'])
@Index('idx_acm_sch_schedule_ent_year', ['entId', 'year'])
export class ScheduleTypeormEntity {
  @PrimaryColumn({ name: 'sched_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'sch_id', type: 'uuid' })
  schId!: string;

  @Column({ name: 'sched_year', type: 'smallint' })
  year!: number;

  @Column({ name: 'sched_type', type: 'varchar', length: 20 })
  type!: ScheduleType;

  @Column({ name: 'sched_open_date', type: 'date', nullable: true })
  openDate?: string | null;

  @Column({ name: 'sched_close_date', type: 'date', nullable: true })
  closeDate?: string | null;

  @Column({ name: 'sched_test_date', type: 'date', nullable: true })
  testDate?: string | null;

  @Column({ name: 'sched_result_date', type: 'date', nullable: true })
  resultDate?: string | null;

  @Column({ name: 'sched_note', type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
