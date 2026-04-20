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
import { MapPassageEntity } from './map-passage.entity';
import { MapItemTagEntity } from './map-item-tag.entity';

@Entity('tac_map_items')
export class MapItemEntity {
  @PrimaryGeneratedColumn({ name: 'itm_id', type: 'bigint', unsigned: true })
  itmId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true, nullable: true })
  acdId: number | null;

  @Column({ name: 'psg_id', type: 'bigint', unsigned: true, nullable: true })
  psgId: number | null;

  @Column({ name: 'itm_parent_itm_id', type: 'bigint', unsigned: true, nullable: true })
  itmParentItmId: number | null;

  @Column({ name: 'itm_domain', type: 'varchar', length: 20 })
  itmDomain: string;

  @Column({ name: 'itm_grade_level', type: 'varchar', length: 10 })
  itmGradeLevel: string;

  @Column({ name: 'itm_difficulty', type: 'varchar', length: 20 })
  itmDifficulty: string;

  @Column({ name: 'itm_item_type', type: 'varchar', length: 20 })
  itmItemType: string;

  @Column({ name: 'itm_stem', type: 'text' })
  itmStem: string;

  @Column({ name: 'itm_options', type: 'json' })
  itmOptions: any;

  @Column({ name: 'itm_answer_keys', type: 'json' })
  itmAnswerKeys: any;

  @Column({ name: 'itm_explanation', type: 'text', nullable: true })
  itmExplanation: string | null;

  @Column({ name: 'itm_points', type: 'int', default: 1 })
  itmPoints: number;

  @Column({ name: 'itm_version', type: 'int', default: 1 })
  itmVersion: number;

  @Column({ name: 'itm_status', type: 'varchar', length: 20, default: 'DRAFT' })
  itmStatus: string;

  @CreateDateColumn({ name: 'itm_created_at' })
  itmCreatedAt: Date;

  @UpdateDateColumn({ name: 'itm_updated_at' })
  itmUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => MapPassageEntity, (p) => p.items)
  @JoinColumn({ name: 'psg_id' })
  passage: MapPassageEntity;

  @ManyToOne(() => MapItemEntity)
  @JoinColumn({ name: 'itm_parent_itm_id' })
  parentItem: MapItemEntity;

  @OneToMany(() => MapItemTagEntity, (t) => t.item)
  tags: MapItemTagEntity[];
}
