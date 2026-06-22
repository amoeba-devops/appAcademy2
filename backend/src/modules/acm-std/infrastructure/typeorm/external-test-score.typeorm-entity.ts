import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 학생 외부 평가 점수 (SSAT / ISEE / GPA 등). Orphan today — schema 보존
 * for v1.1 revival. 학생 프로필 페이지의 "외부 시험 이력" 섹션 후보.
 *
 * @see sql/acm/975-acm-csl-aux.sql §3
 */
@Entity('amb_acm_std_external_test_score')
@Index('idx_acm_std_external_test_score_std', ['studentId', 'testDate'])
export class ExternalTestScoreTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ets_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'std_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'ets_test_type', type: 'varchar', length: 20 })
  testType!: string;

  @Column({ name: 'ets_test_date', type: 'date' })
  testDate!: string;

  @Column({ name: 'ets_score', type: 'varchar', length: 50, nullable: true })
  score?: string | null;

  /** Section / subscore detail — e.g. { verbal: 720, math: 750 } for SSAT. */
  @Column({ name: 'ets_score_detail', type: 'jsonb', nullable: true })
  scoreDetail?: unknown | null;

  @Column({ name: 'ets_note', type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
