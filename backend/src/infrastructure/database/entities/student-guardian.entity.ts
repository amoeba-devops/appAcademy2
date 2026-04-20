import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StudentEntity } from './student.entity';
import { ParentEntity } from './parent.entity';

@Entity('tac_student_guardians')
export class StudentGuardianEntity {
  @PrimaryGeneratedColumn({ name: 'sgd_id', type: 'bigint', unsigned: true })
  sgdId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'prt_id', type: 'bigint', unsigned: true })
  prtId: number;

  @Column({ name: 'sgd_relationship', type: 'varchar', length: 20, nullable: true })
  sgdRelationship: string | null;

  @Column({ name: 'sgd_is_primary', type: 'boolean', default: false })
  sgdIsPrimary: boolean;

  @ManyToOne(() => StudentEntity, (s) => s.guardians)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;

  @ManyToOne(() => ParentEntity, (p) => p.guardianships)
  @JoinColumn({ name: 'prt_id' })
  parent: ParentEntity;
}
