import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MapItemTypeormEntity } from './map-item.typeorm-entity';
import { MapTestSetTypeormEntity } from './map-test-set.typeorm-entity';

/** @see sql/acm/955-acm-map-expand.sql §5 — UNIQUE (mts_id, mtsi_ordinal) */
@Entity('amb_acm_map_test_set_item')
@Index('uq_acm_map_test_set_item_ordinal', ['testSetId', 'ordinal'], { unique: true })
@Index('idx_acm_map_test_set_item_item', ['itemId'])
export class MapTestSetItemTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mtsi_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'mts_id', type: 'uuid' })
  testSetId!: string;

  @ManyToOne(() => MapTestSetTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mts_id', referencedColumnName: 'id' })
  testSet?: MapTestSetTypeormEntity;

  @Column({ name: 'mpi_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => MapItemTypeormEntity)
  @JoinColumn({ name: 'mpi_id', referencedColumnName: 'id' })
  item?: MapItemTypeormEntity;

  @Column({ name: 'mtsi_ordinal', type: 'integer' })
  ordinal!: number;

  /** Item snapshot at assignment time — FR-028 (mark to mark grading). */
  @Column({ name: 'mtsi_item_version_snapshot', type: 'jsonb' })
  itemVersionSnapshot!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
