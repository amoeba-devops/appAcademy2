import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MapTestSetMode = 'FIXED' | 'AUTO';
export type MapTestSetStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** @see sql/acm/955-acm-map-expand.sql §4 */
@Entity('amb_acm_map_test_set')
@Index('idx_acm_map_test_set_ent', ['entId', 'status'])
export class MapTestSetTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mts_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mts_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'mts_composition_mode', type: 'varchar', length: 20, default: 'FIXED' })
  compositionMode!: MapTestSetMode;

  @Column({ name: 'mts_filter_criteria', type: 'jsonb', nullable: true })
  filterCriteria?: unknown | null;

  @Column({ name: 'mts_total_points', type: 'integer', default: 0 })
  totalPoints!: number;

  @Column({ name: 'mts_status', type: 'varchar', length: 20, default: 'DRAFT' })
  status!: MapTestSetStatus;

  @Column({ name: 'mts_created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
