import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { MapItemEntity } from './map-item.entity';

@Entity('tac_map_item_tags')
export class MapItemTagEntity {
  @PrimaryColumn({ name: 'itm_id', type: 'bigint', unsigned: true })
  itmId: number;

  @PrimaryColumn({ name: 'itg_tag', type: 'varchar', length: 50 })
  itgTag: string;

  @ManyToOne(() => MapItemEntity, (i) => i.tags)
  @JoinColumn({ name: 'itm_id' })
  item: MapItemEntity;
}
