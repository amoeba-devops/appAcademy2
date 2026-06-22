import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { MapItemTypeormEntity } from './map-item.typeorm-entity';

/**
 * @see sql/acm/955-acm-map-expand.sql §3 (composite PK: mpi_id, mit_tag)
 */
@Entity('amb_acm_map_item_tag')
@Index('idx_acm_map_item_tag_tag', ['tag'])
export class MapItemTagTypeormEntity {
  @Column({ name: 'mpi_id', type: 'uuid', primary: true })
  itemId!: string;

  @ManyToOne(() => MapItemTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mpi_id', referencedColumnName: 'id' })
  item?: MapItemTypeormEntity;

  @Column({ name: 'mit_tag', type: 'varchar', length: 50, primary: true })
  tag!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
