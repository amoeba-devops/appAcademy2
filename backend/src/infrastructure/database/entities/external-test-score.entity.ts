import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentEntity } from './student.entity';

@Entity('tac_external_test_scores')
export class ExternalTestScoreEntity {
  @PrimaryGeneratedColumn({ name: 'ets_id', type: 'bigint', unsigned: true })
  etsId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'ets_test_type', type: 'varchar', length: 20 })
  etsTestType: string;

  @Column({ name: 'ets_test_date', type: 'date' })
  etsTestDate: string;

  @Column({ name: 'ets_score_raw', type: 'varchar', length: 50 })
  etsScoreRaw: string;

  @Column({ name: 'ets_score_percentile', type: 'int', nullable: true })
  etsScorePercentile: number | null;

  @Column({ name: 'ets_note', type: 'text', nullable: true })
  etsNote: string | null;

  @CreateDateColumn({ name: 'ets_created_at' })
  etsCreatedAt: Date;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;
}
