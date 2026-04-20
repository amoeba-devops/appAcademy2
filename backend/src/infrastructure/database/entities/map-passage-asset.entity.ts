import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MapPassageEntity } from './map-passage.entity';

@Entity('tac_map_passage_assets')
export class MapPassageAssetEntity {
  @PrimaryGeneratedColumn({ name: 'pas_id', type: 'bigint', unsigned: true })
  pasId: number;

  @Column({ name: 'psg_id', type: 'bigint', unsigned: true })
  psgId: number;

  @Column({ name: 'pas_asset_url', type: 'varchar', length: 500 })
  pasAssetUrl: string;

  @Column({ name: 'pas_alt_text', type: 'varchar', length: 200, nullable: true })
  pasAltText: string | null;

  @Column({ name: 'pas_ordinal', type: 'int', default: 0 })
  pasOrdinal: number;

  @ManyToOne(() => MapPassageEntity, (p) => p.assets)
  @JoinColumn({ name: 'psg_id' })
  passage: MapPassageEntity;
}
