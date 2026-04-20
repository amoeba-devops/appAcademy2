import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentEntity } from './student.entity';

@Entity('tac_counseling_records')
export class CounselingRecordEntity {
  @PrimaryGeneratedColumn({ name: 'cnr_id', type: 'bigint', unsigned: true })
  cnrId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'cnr_counseled_at', type: 'datetime' })
  cnrCounseledAt: Date;

  @Column({ name: 'cnr_counselor_user_id', type: 'bigint', unsigned: true, nullable: true })
  cnrCounselorUserId: number | null;

  @Column({ name: 'cnr_topics', type: 'json', nullable: true })
  cnrTopics: any | null;

  @Column({ name: 'cnr_goals', type: 'json', nullable: true })
  cnrGoals: any | null;

  @Column({ name: 'cnr_satisfaction_note', type: 'text', nullable: true })
  cnrSatisfactionNote: string | null;

  @Column({ name: 'cnr_next_action', type: 'text', nullable: true })
  cnrNextAction: string | null;

  @CreateDateColumn({ name: 'cnr_created_at' })
  cnrCreatedAt: Date;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;
}
