import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MapAssignmentTypeormEntity } from './map-assignment.typeorm-entity';
import { MapItemTypeormEntity } from './map-item.typeorm-entity';

/**
 * 학생 응답 — UNIQUE (mas_id, std_id, mpi_id) 로 멱등 채점 보장.
 * @see sql/acm/955-acm-map-expand.sql §7
 */
@Entity('amb_acm_map_response')
@Index('uq_acm_map_response_asn_std_itm', ['assignmentId', 'studentId', 'itemId'], { unique: true })
@Index('idx_acm_map_response_std', ['studentId', 'submittedAt'])
export class MapResponseTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mrs_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'mas_id', type: 'uuid' })
  assignmentId!: string;

  @ManyToOne(() => MapAssignmentTypeormEntity)
  @JoinColumn({ name: 'mas_id', referencedColumnName: 'id' })
  assignment?: MapAssignmentTypeormEntity;

  @Column({ name: 'std_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'mpi_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => MapItemTypeormEntity)
  @JoinColumn({ name: 'mpi_id', referencedColumnName: 'id' })
  item?: MapItemTypeormEntity;

  @Column({ name: 'mrs_answer', type: 'jsonb' })
  answer!: unknown;

  @Column({ name: 'mrs_is_correct', type: 'boolean' })
  isCorrect!: boolean;

  @Column({ name: 'mrs_points_earned', type: 'integer', default: 0 })
  pointsEarned!: number;

  @Column({ name: 'mrs_submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
