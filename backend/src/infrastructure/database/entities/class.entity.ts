import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { ProgramEntity } from './program.entity';
import { TeacherEntity } from './teacher.entity';
import { ClassroomEntity } from './classroom.entity';
import { ClassSessionEntity } from './class-session.entity';
import { EnrollmentEntity } from './enrollment.entity';

@Entity('tac_classes')
export class ClassEntity {
  @PrimaryGeneratedColumn({ name: 'cls_id', type: 'bigint', unsigned: true })
  clsId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'prg_id', type: 'bigint', unsigned: true })
  prgId: number;

  @Column({ name: 'tch_id', type: 'bigint', unsigned: true })
  tchId: number;

  @Column({ name: 'clr_id', type: 'bigint', unsigned: true, nullable: true })
  clrId: number | null;

  @Column({ name: 'cls_start_date', type: 'date' })
  clsStartDate: string;

  @Column({ name: 'cls_end_date', type: 'date', nullable: true })
  clsEndDate: string | null;

  @Column({ name: 'cls_capacity', type: 'int' })
  clsCapacity: number;

  @Column({ name: 'cls_enrolled_count', type: 'int', default: 0 })
  clsEnrolledCount: number;

  @Column({ name: 'cls_status', type: 'varchar', length: 20, default: 'DRAFT' })
  clsStatus: string;

  @Column({ name: 'cls_schedule_pattern', type: 'json' })
  clsSchedulePattern: any;

  @CreateDateColumn({ name: 'cls_created_at' })
  clsCreatedAt: Date;

  @UpdateDateColumn({ name: 'cls_updated_at' })
  clsUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => ProgramEntity, (p) => p.classes)
  @JoinColumn({ name: 'prg_id' })
  program: ProgramEntity;

  @ManyToOne(() => TeacherEntity, (t) => t.classes)
  @JoinColumn({ name: 'tch_id' })
  teacher: TeacherEntity;

  @ManyToOne(() => ClassroomEntity)
  @JoinColumn({ name: 'clr_id' })
  classroom: ClassroomEntity;

  @OneToMany(() => ClassSessionEntity, (cs) => cs.class)
  sessions: ClassSessionEntity[];

  @OneToMany(() => EnrollmentEntity, (e) => e.class)
  enrollments: EnrollmentEntity[];
}
