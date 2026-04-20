import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ClassEntity } from './class.entity';
import { AttendanceEntity } from './attendance.entity';

@Entity('tac_class_sessions')
export class ClassSessionEntity {
  @PrimaryGeneratedColumn({ name: 'csn_id', type: 'bigint', unsigned: true })
  csnId: number;

  @Column({ name: 'cls_id', type: 'bigint', unsigned: true })
  clsId: number;

  @Column({ name: 'csn_session_no', type: 'int' })
  csnSessionNo: number;

  @Column({ name: 'csn_start_at', type: 'datetime' })
  csnStartAt: Date;

  @Column({ name: 'csn_end_at', type: 'datetime' })
  csnEndAt: Date;

  @Column({ name: 'csn_planned_duration_hours', type: 'decimal', precision: 3, scale: 1, nullable: true })
  csnPlannedDurationHours: string | null;

  @Column({ name: 'csn_actual_duration_hours', type: 'decimal', precision: 3, scale: 1, nullable: true })
  csnActualDurationHours: string | null;

  @Column({ name: 'csn_status', type: 'varchar', length: 20, default: 'SCHEDULED' })
  csnStatus: string;

  @Column({ name: 'csn_session_status', type: 'varchar', length: 20, default: 'SCHEDULED' })
  csnSessionStatus: string;

  @Column({ name: 'csn_cancel_reason', type: 'varchar', length: 100, nullable: true })
  csnCancelReason: string | null;

  @Column({ name: 'csn_makeup_csn_id', type: 'bigint', unsigned: true, nullable: true })
  csnMakeupCsnId: number | null;

  @Column({ name: 'csn_memo', type: 'text', nullable: true })
  csnMemo: string | null;

  @ManyToOne(() => ClassEntity, (c) => c.sessions)
  @JoinColumn({ name: 'cls_id' })
  class: ClassEntity;

  @ManyToOne(() => ClassSessionEntity)
  @JoinColumn({ name: 'csn_makeup_csn_id' })
  makeupOf: ClassSessionEntity;

  @OneToMany(() => AttendanceEntity, (a) => a.session)
  attendances: AttendanceEntity[];
}
