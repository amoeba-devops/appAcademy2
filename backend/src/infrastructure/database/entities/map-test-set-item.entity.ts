import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MapTestSetEntity } from './map-test-set.entity';
import { MapItemEntity } from './map-item.entity';

@Entity('tac_map_test_set_items')
export class MapTestSetItemEntity {
  @PrimaryGeneratedColumn({ name: 'tsi_id', type: 'bigint', unsigned: true })
  tsiId: number;

  @Column({ name: 'tst_id', type: 'bigint', unsigned: true })
  tstId: number;

  @Column({ name: 'itm_id', type: 'bigint', unsigned: true })
  itmId: number;

  @Column({ name: 'tsi_ordinal', type: 'int' })
  tsiOrdinal: number;

  @Column({ name: 'tsi_item_version_snapshot', type: 'json' })
  tsiItemVersionSnapshot: any;

  @ManyToOne(() => MapTestSetEntity, (ts) => ts.items)
  @JoinColumn({ name: 'tst_id' })
  testSet: MapTestSetEntity;

  @ManyToOne(() => MapItemEntity)
  @JoinColumn({ name: 'itm_id' })
  item: MapItemEntity;
}
