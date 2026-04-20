import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConsultationEntity } from './consultation.entity';

@Entity('tac_visit_records')
export class VisitRecordEntity {
  @PrimaryGeneratedColumn({ name: 'vsr_id', type: 'bigint', unsigned: true })
  vsrId: number;

  @Column({ name: 'cst_id', type: 'bigint', unsigned: true })
  cstId: number;

  @Column({ name: 'vsr_scheduled_at', type: 'datetime', nullable: true })
  vsrScheduledAt: Date | null;

  @Column({ name: 'vsr_visited_at', type: 'datetime', nullable: true })
  vsrVisitedAt: Date | null;

  @Column({ name: 'vsr_outcome', type: 'varchar', length: 20, nullable: true })
  vsrOutcome: string | null;

  @Column({ name: 'vsr_handler_user_id', type: 'bigint', unsigned: true, nullable: true })
  vsrHandlerUserId: number | null;

  @Column({ name: 'vsr_memo', type: 'text', nullable: true })
  vsrMemo: string | null;

  @CreateDateColumn({ name: 'vsr_created_at' })
  vsrCreatedAt: Date;

  @ManyToOne(() => ConsultationEntity, (c) => c.visitRecords)
  @JoinColumn({ name: 'cst_id' })
  consultation: ConsultationEntity;
}
