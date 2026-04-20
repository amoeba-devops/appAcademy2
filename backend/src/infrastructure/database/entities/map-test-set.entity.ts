import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { MapTestSetItemEntity } from './map-test-set-item.entity';

@Entity('tac_map_test_sets')
export class MapTestSetEntity {
  @PrimaryGeneratedColumn({ name: 'tst_id', type: 'bigint', unsigned: true })
  tstId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'tst_name', type: 'varchar', length: 100 })
  tstName: string;

  @Column({ name: 'tst_composition_mode', type: 'varchar', length: 20, default: 'FIXED' })
  tstCompositionMode: string;

  @Column({ name: 'tst_filter_criteria', type: 'json', nullable: true })
  tstFilterCriteria: any | null;

  @Column({ name: 'tst_total_points', type: 'int', default: 0 })
  tstTotalPoints: number;

  @Column({ name: 'tst_status', type: 'varchar', length: 20, default: 'DRAFT' })
  tstStatus: string;

  @Column({ name: 'tst_created_by', type: 'bigint', unsigned: true, nullable: true })
  tstCreatedBy: number | null;

  @CreateDateColumn({ name: 'tst_created_at' })
  tstCreatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @OneToMany(() => MapTestSetItemEntity, (i) => i.testSet)
  items: MapTestSetItemEntity[];
}
