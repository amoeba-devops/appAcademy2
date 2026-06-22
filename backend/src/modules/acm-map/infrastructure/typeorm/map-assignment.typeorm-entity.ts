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
import { MapTestSetTypeormEntity } from './map-test-set.typeorm-entity';

export type MapAssignmentTargetType = 'CLASS' | 'STUDENT';
export type MapAssignmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'GRADED'
  | 'CANCELED';

/** @see sql/acm/955-acm-map-expand.sql §6 */
@Entity('amb_acm_map_assignment')
@Index('idx_acm_map_assignment_target', ['targetType', 'targetId', 'status'])
@Index('idx_acm_map_assignment_due', ['dueAt'])
export class MapAssignmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mas_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'mts_id', type: 'uuid' })
  testSetId!: string;

  @ManyToOne(() => MapTestSetTypeormEntity)
  @JoinColumn({ name: 'mts_id', referencedColumnName: 'id' })
  testSet?: MapTestSetTypeormEntity;

  @Column({ name: 'mas_target_type', type: 'varchar', length: 20 })
  targetType!: MapAssignmentTargetType;

  @Column({ name: 'mas_target_id', type: 'uuid' })
  targetId!: string;

  @Column({ name: 'mas_due_at', type: 'timestamptz' })
  dueAt!: Date;

  @Column({ name: 'mas_status', type: 'varchar', length: 20, default: 'ASSIGNED' })
  status!: MapAssignmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
