import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StdStatus = 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN';
export type StdGender = 'M' | 'F';

@Entity('amb_acm_std_student')
@Index('idx_acm_std_ent_status', ['entId', 'status'], { where: 'deleted_at IS NULL' })
export class StudentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'std_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  // 기본 인적사항
  @Column({ name: 'std_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'std_english_name', type: 'varchar', length: 100, nullable: true })
  englishName?: string | null;

  @Column({ name: 'std_gender', type: 'char', length: 1, nullable: true })
  gender?: string | null;

  @Column({ name: 'std_birth_date', type: 'date', nullable: true })
  birthDate?: string | null;

  @Column({ name: 'std_phone', type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'std_email', type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ name: 'std_residence', type: 'varchar', length: 100, nullable: true })
  residence?: string | null;

  // 학교 정보
  @Column({ name: 'std_school', type: 'varchar', length: 100, nullable: true })
  school?: string | null;

  @Column({ name: 'std_grade', type: 'varchar', length: 20, nullable: true })
  grade?: string | null;

  // MAP 점수
  @Column({ name: 'std_map_reading', type: 'smallint', nullable: true })
  mapReading?: number | null;

  @Column({ name: 'std_map_math', type: 'smallint', nullable: true })
  mapMath?: number | null;

  @Column({ name: 'std_map_language', type: 'smallint', nullable: true })
  mapLanguage?: number | null;

  @Column({ name: 'std_map_note', type: 'text', nullable: true })
  mapNote?: string | null;

  // 수업 정보
  @Column({ name: 'std_teacher', type: 'varchar', length: 100, nullable: true })
  teacher?: string | null;

  @Column({ name: 'std_subject', type: 'varchar', length: 100, nullable: true })
  subject?: string | null;

  @Column({ name: 'std_curriculum', type: 'text', nullable: true })
  curriculum?: string | null;

  @Column({ name: 'std_materials', type: 'text', nullable: true })
  materials?: string | null;

  @Column({ name: 'std_schedule_json', type: 'jsonb', nullable: true })
  scheduleJson?: unknown | null;

  @Column({ name: 'std_mobility', type: 'varchar', length: 50, nullable: true })
  mobility?: string | null;

  // 상담/목표
  @Column({ name: 'std_gpa', type: 'varchar', length: 20, nullable: true })
  gpa?: string | null;

  @Column({ name: 'std_ssat_isee_note', type: 'text', nullable: true })
  ssatIseeNote?: string | null;

  @Column({ name: 'std_special_note', type: 'text', nullable: true })
  specialNote?: string | null;

  @Column({ name: 'std_goals_note', type: 'text', nullable: true })
  goalsNote?: string | null;

  @Column({ name: 'std_satisfaction_note', type: 'varchar', length: 200, nullable: true })
  satisfactionNote?: string | null;

  @Column({ name: 'std_last_counsel_date', type: 'date', nullable: true })
  lastCounselDate?: string | null;

  // 상태/등록
  @Column({ name: 'std_start_date', type: 'date', nullable: true })
  startDate?: string | null;

  @Column({ name: 'std_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: StdStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
