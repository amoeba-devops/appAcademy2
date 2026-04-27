import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RecDayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type RecDefaultMode = 'IN_PERSON' | 'ONLINE' | 'TWO_PERSON_IN_PERSON';

@Entity('amb_acm_cls_recurrence')
@Index('idx_acm_cls_rec_cls_idx', ['clsId'])
export class RecurrenceTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'rec_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  clsId!: string;

  @Column({ name: 'rec_day_of_week', type: 'varchar', length: 3 })
  dayOfWeek!: RecDayOfWeek;

  @Column({ name: 'rec_start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'rec_duration_min', type: 'int' })
  durationMin!: number;

  @Column({ name: 'rec_default_mode', type: 'varchar', length: 25, default: 'ONLINE' })
  defaultMode!: RecDefaultMode;

  @Column({ name: 'rec_effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'rec_effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'rec_exceptions', type: 'jsonb', nullable: true })
  exceptions?: string[] | null;

  @Column({ name: 'rec_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'rec_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
