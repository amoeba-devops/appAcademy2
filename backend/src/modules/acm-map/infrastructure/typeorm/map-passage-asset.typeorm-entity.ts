import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MapPassageTypeormEntity } from './map-passage.typeorm-entity';

/**
 * @see sql/acm/955-acm-map-expand.sql §1
 */
@Entity('amb_acm_map_passage_asset')
@Index('idx_acm_map_passage_asset_passage', ['passageId', 'ordinal'])
export class MapPassageAssetTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mpa_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'mpg_id', type: 'uuid' })
  passageId!: string;

  @ManyToOne(() => MapPassageTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mpg_id', referencedColumnName: 'id' })
  passage?: MapPassageTypeormEntity;

  @Column({ name: 'mpa_asset_url', type: 'varchar', length: 500 })
  assetUrl!: string;

  @Column({ name: 'mpa_alt_text', type: 'varchar', length: 200, nullable: true })
  altText?: string | null;

  @Column({ name: 'mpa_ordinal', type: 'integer', default: 0 })
  ordinal!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
