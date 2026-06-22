import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MapItemDomain = 'RC' | 'MATH' | 'LANGUAGE';
export type MapItemDifficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
export type MapItemType = 'SINGLE' | 'MULTI' | 'PART_AB';
export type MapItemStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/**
 * MAP 문항 — 단일/멀티/Part A-B 부모-자식 자기참조. JSONB options + answer_keys.
 * @see sql/acm/955-acm-map-expand.sql §2
 */
@Entity('amb_acm_map_item')
@Index('idx_acm_map_item_taxonomy', ['domain', 'gradeLevel', 'difficulty', 'status'])
@Index('idx_acm_map_item_passage', ['passageId'])
@Index('idx_acm_map_item_parent', ['parentItemId'])
export class MapItemTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mpi_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId?: string | null;

  @Column({ name: 'mpg_id', type: 'uuid', nullable: true })
  passageId?: string | null;

  @Column({ name: 'mpi_parent_mpi_id', type: 'uuid', nullable: true })
  parentItemId?: string | null;

  @Column({ name: 'mpi_domain', type: 'varchar', length: 20 })
  domain!: MapItemDomain;

  @Column({ name: 'mpi_grade_level', type: 'varchar', length: 10 })
  gradeLevel!: string;

  @Column({ name: 'mpi_difficulty', type: 'varchar', length: 20 })
  difficulty!: MapItemDifficulty;

  @Column({ name: 'mpi_item_type', type: 'varchar', length: 20 })
  itemType!: MapItemType;

  @Column({ name: 'mpi_stem', type: 'text' })
  stem!: string;

  @Column({ name: 'mpi_options', type: 'jsonb' })
  options!: unknown;

  @Column({ name: 'mpi_answer_keys', type: 'jsonb' })
  answerKeys!: unknown;

  @Column({ name: 'mpi_explanation', type: 'text', nullable: true })
  explanation?: string | null;

  @Column({ name: 'mpi_points', type: 'integer', default: 1 })
  points!: number;

  @Column({ name: 'mpi_version', type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'mpi_status', type: 'varchar', length: 20, default: 'DRAFT' })
  status!: MapItemStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
