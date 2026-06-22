import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MapAssignmentTypeormEntity } from './map-assignment.typeorm-entity';

export type MapScoreSource = 'SYSTEM' | 'IMPORT' | 'MANUAL';

/** @see sql/acm/955-acm-map-expand.sql §8 — 외부 MAP 점수 (RC/Math/Language) */
@Entity('amb_acm_map_score')
@Index('idx_acm_map_score_std_date', ['studentId', 'assessedAt'])
export class MapScoreTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mms_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'std_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'mms_assessed_at', type: 'date' })
  assessedAt!: string;

  @Column({ name: 'mms_reading_score', type: 'integer', nullable: true })
  readingScore?: number | null;

  @Column({ name: 'mms_math_score', type: 'integer', nullable: true })
  mathScore?: number | null;

  @Column({ name: 'mms_language_score', type: 'integer', nullable: true })
  languageScore?: number | null;

  @Column({ name: 'mms_source', type: 'varchar', length: 20, default: 'SYSTEM' })
  source!: MapScoreSource;

  @Column({ name: 'mas_id', type: 'uuid', nullable: true })
  assignmentId?: string | null;

  @ManyToOne(() => MapAssignmentTypeormEntity, { nullable: true })
  @JoinColumn({ name: 'mas_id', referencedColumnName: 'id' })
  assignment?: MapAssignmentTypeormEntity | null;

  @Column({ name: 'mms_note', type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
