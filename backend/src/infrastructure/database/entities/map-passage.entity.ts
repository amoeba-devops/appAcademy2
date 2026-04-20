import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { MapPassageAssetEntity } from './map-passage-asset.entity';
import { MapItemEntity } from './map-item.entity';

@Entity('tac_map_passages')
export class MapPassageEntity {
  @PrimaryGeneratedColumn({ name: 'psg_id', type: 'bigint', unsigned: true })
  psgId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true, nullable: true })
  acdId: number | null;

  @Column({ name: 'psg_title', type: 'varchar', length: 200 })
  psgTitle: string;

  @Column({ name: 'psg_body', type: 'mediumtext' })
  psgBody: string;

  @Column({ name: 'psg_grade_level', type: 'varchar', length: 10 })
  psgGradeLevel: string;

  @Column({ name: 'psg_domain', type: 'varchar', length: 20, default: 'RC' })
  psgDomain: string;

  @Column({ name: 'psg_pair_group_id', type: 'bigint', unsigned: true, nullable: true })
  psgPairGroupId: number | null;

  @Column({ name: 'psg_source', type: 'varchar', length: 200, nullable: true })
  psgSource: string | null;

  @Column({ name: 'psg_version', type: 'int', default: 1 })
  psgVersion: number;

  @Column({ name: 'psg_status', type: 'varchar', length: 20, default: 'DRAFT' })
  psgStatus: string;

  @CreateDateColumn({ name: 'psg_created_at' })
  psgCreatedAt: Date;

  @UpdateDateColumn({ name: 'psg_updated_at' })
  psgUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @OneToMany(() => MapPassageAssetEntity, (a) => a.passage)
  assets: MapPassageAssetEntity[];

  @OneToMany(() => MapItemEntity, (i) => i.passage)
  items: MapItemEntity[];
}
