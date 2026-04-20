import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentEntity } from './student.entity';
import { MapAssignmentEntity } from './map-assignment.entity';

@Entity('tac_map_scores')
export class MapScoreEntity {
  @PrimaryGeneratedColumn({ name: 'msc_id', type: 'bigint', unsigned: true })
  mscId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'msc_assessed_at', type: 'date' })
  mscAssessedAt: string;

  @Column({ name: 'msc_reading_score', type: 'int', nullable: true })
  mscReadingScore: number | null;

  @Column({ name: 'msc_math_score', type: 'int', nullable: true })
  mscMathScore: number | null;

  @Column({ name: 'msc_language_score', type: 'int', nullable: true })
  mscLanguageScore: number | null;

  @Column({ name: 'msc_source', type: 'varchar', length: 20, default: 'SYSTEM' })
  mscSource: string;

  @Column({ name: 'asn_id', type: 'bigint', unsigned: true, nullable: true })
  asnId: number | null;

  @Column({ name: 'msc_note', type: 'text', nullable: true })
  mscNote: string | null;

  @CreateDateColumn({ name: 'msc_created_at' })
  mscCreatedAt: Date;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;

  @ManyToOne(() => MapAssignmentEntity)
  @JoinColumn({ name: 'asn_id' })
  assignment: MapAssignmentEntity;
}
