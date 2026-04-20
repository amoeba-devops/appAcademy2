import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { ClassEntity } from './class.entity';
import { StudentEntity } from './student.entity';
import { ParentEntity } from './parent.entity';

@Entity('tac_enrollments')
export class EnrollmentEntity {
  @PrimaryGeneratedColumn({ name: 'enr_id', type: 'bigint', unsigned: true })
  enrId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'cls_id', type: 'bigint', unsigned: true })
  clsId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'enr_applied_prt_id', type: 'bigint', unsigned: true })
  enrAppliedPrtId: number;

  @Column({ name: 'enr_status', type: 'varchar', length: 20, default: 'PENDING' })
  enrStatus: string;

  @Column({ name: 'enr_applied_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  enrAppliedAt: Date;

  @Column({ name: 'enr_confirmed_at', type: 'datetime', nullable: true })
  enrConfirmedAt: Date | null;

  @Column({ name: 'enr_canceled_at', type: 'datetime', nullable: true })
  enrCanceledAt: Date | null;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => ClassEntity, (c) => c.enrollments)
  @JoinColumn({ name: 'cls_id' })
  class: ClassEntity;

  @ManyToOne(() => StudentEntity, (s) => s.enrollments)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;

  @ManyToOne(() => ParentEntity)
  @JoinColumn({ name: 'enr_applied_prt_id' })
  appliedParent: ParentEntity;
}
