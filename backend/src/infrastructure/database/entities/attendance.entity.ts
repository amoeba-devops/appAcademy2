import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ClassSessionEntity } from './class-session.entity';
import { StudentEntity } from './student.entity';

@Entity('tac_attendances')
export class AttendanceEntity {
  @PrimaryGeneratedColumn({ name: 'att_id', type: 'bigint', unsigned: true })
  attId: number;

  @Column({ name: 'csn_id', type: 'bigint', unsigned: true })
  csnId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'att_status', type: 'varchar', length: 20 })
  attStatus: string;

  @Column({ name: 'att_memo', type: 'text', nullable: true })
  attMemo: string | null;

  @Column({ name: 'att_recorded_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  attRecordedAt: Date;

  @ManyToOne(() => ClassSessionEntity, (cs) => cs.attendances)
  @JoinColumn({ name: 'csn_id' })
  session: ClassSessionEntity;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;
}
