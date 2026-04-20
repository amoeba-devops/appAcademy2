import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { MapTestSetEntity } from './map-test-set.entity';
import { MapResponseEntity } from './map-response.entity';

@Entity('tac_map_assignments')
export class MapAssignmentEntity {
  @PrimaryGeneratedColumn({ name: 'asn_id', type: 'bigint', unsigned: true })
  asnId: number;

  @Column({ name: 'tst_id', type: 'bigint', unsigned: true })
  tstId: number;

  @Column({ name: 'asn_target_type', type: 'varchar', length: 20 })
  asnTargetType: string;

  @Column({ name: 'asn_target_id', type: 'bigint', unsigned: true })
  asnTargetId: number;

  @Column({ name: 'asn_due_at', type: 'datetime' })
  asnDueAt: Date;

  @Column({ name: 'asn_status', type: 'varchar', length: 20, default: 'ASSIGNED' })
  asnStatus: string;

  @CreateDateColumn({ name: 'asn_created_at' })
  asnCreatedAt: Date;

  @ManyToOne(() => MapTestSetEntity)
  @JoinColumn({ name: 'tst_id' })
  testSet: MapTestSetEntity;

  @OneToMany(() => MapResponseEntity, (r) => r.assignment)
  responses: MapResponseEntity[];
}
