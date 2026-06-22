import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProgramStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

/** @see sql/acm/970-acm-posts-schema.sql §2 — 프로그램 카탈로그 */
@Entity('amb_acm_program')
@Index('uq_acm_program_ent_name', ['entId', 'name'], { unique: true })
@Index('idx_acm_program_ent_status', ['entId', 'status'])
export class ProgramTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'prg_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'prg_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'prg_category', type: 'varchar', length: 30 })
  category!: string;

  @Column({ name: 'prg_description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'prg_duration_weeks', type: 'integer', nullable: true })
  durationWeeks?: number | null;

  @Column({ name: 'prg_target_age_min', type: 'integer', nullable: true })
  targetAgeMin?: number | null;

  @Column({ name: 'prg_target_age_max', type: 'integer', nullable: true })
  targetAgeMax?: number | null;

  @Column({ name: 'prg_level', type: 'varchar', length: 20, nullable: true })
  level?: string | null;

  @Column({ name: 'prg_status', type: 'varchar', length: 20, default: 'DRAFT' })
  status!: ProgramStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
