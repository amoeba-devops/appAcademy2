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
import { ParentEntity } from './parent.entity';
import { StudentGuardianEntity } from './student-guardian.entity';
import { EnrollmentEntity } from './enrollment.entity';

@Entity('tac_students')
export class StudentEntity {
  @PrimaryGeneratedColumn({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'prt_id', type: 'bigint', unsigned: true })
  prtId: number;

  @Column({ name: 'std_name', type: 'varchar', length: 100 })
  stdName: string;

  @Column({ name: 'std_birth_date', type: 'date', nullable: true })
  stdBirthDate: string | null;

  @Column({ name: 'std_gender', type: 'char', length: 1, nullable: true })
  stdGender: string | null;

  @Column({ name: 'std_school', type: 'varchar', length: 100, nullable: true })
  stdSchool: string | null;

  @Column({ name: 'std_grade', type: 'varchar', length: 20, nullable: true })
  stdGrade: string | null;

  @Column({ name: 'std_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  stdStatus: string;

  @Column({ name: 'std_lifecycle_status', type: 'varchar', length: 20, default: 'CONSULTING' })
  stdLifecycleStatus: string;

  @Column({ name: 'std_terminated_at', type: 'datetime', nullable: true })
  stdTerminatedAt: Date | null;

  @Column({ name: 'std_termination_reason', type: 'varchar', length: 100, nullable: true })
  stdTerminationReason: string | null;

  @CreateDateColumn({ name: 'std_created_at' })
  stdCreatedAt: Date;

  @UpdateDateColumn({ name: 'std_updated_at' })
  stdUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => ParentEntity, (p) => p.students)
  @JoinColumn({ name: 'prt_id' })
  primaryParent: ParentEntity;

  @OneToMany(() => StudentGuardianEntity, (sg) => sg.student)
  guardians: StudentGuardianEntity[];

  @OneToMany(() => EnrollmentEntity, (e) => e.student)
  enrollments: EnrollmentEntity[];
}
