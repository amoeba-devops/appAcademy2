import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TchStatus = 'ACTIVE' | 'LEAVE' | 'RESIGNED';
export type TchEmploymentType = 'FULL_TIME' | 'PART_TIME';
export type TchSubject =
  | 'MAP'
  | 'MATH'
  | 'WRITING'
  | 'LANGUAGE_ARTS'
  | 'SSAT'
  | 'ISEE'
  | 'INTL_PREP'
  | 'OTHER';

@Entity('amb_acm_tch_teacher')
@Index('idx_acm_tch_ent_status', ['entId', 'status'], { where: 'deleted_at IS NULL' })
export class TeacherTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'tch_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tch_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'tch_english_name', type: 'varchar', length: 100, nullable: true })
  englishName?: string | null;

  @Column({ name: 'tch_email', type: 'varchar', length: 200 })
  email!: string;

  @Column({ name: 'tch_phone', type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'tch_birth_date', type: 'date', nullable: true })
  birthDate?: string | null;

  @Column({ name: 'tch_subjects', type: 'jsonb', default: () => `'[]'::jsonb` })
  subjects!: TchSubject[];

  @Column({ name: 'tch_memo', type: 'text', nullable: true })
  memo?: string | null;

  @Column({ name: 'tch_user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'tch_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: TchStatus;

  // --- REQ-260510 additions ---
  @Column({ name: 'tch_is_instructor', type: 'boolean', default: true })
  isInstructor!: boolean;

  @Column({ name: 'tch_employment_type', type: 'varchar', length: 20, default: 'FULL_TIME' })
  employmentType!: TchEmploymentType;

  @Column({ name: 'tch_hired_at', type: 'date', nullable: true })
  hiredAt?: string | null;

  @Column({ name: 'tch_attendance_no', type: 'varchar', length: 50, nullable: true })
  attendanceNo?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
