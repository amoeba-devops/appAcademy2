import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProgramEntity } from './program.entity';
import { ClassroomEntity } from './classroom.entity';
import { TeacherEntity } from './teacher.entity';
import { ParentEntity } from './parent.entity';
import { UserEntity } from './user.entity';

@Entity('tac_academies')
export class AcademyEntity {
  @PrimaryGeneratedColumn({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'acd_name', type: 'varchar', length: 200 })
  acdName: string;

  @Column({ name: 'acd_business_registration_no', type: 'varchar', length: 30, nullable: true })
  acdBusinessRegistrationNo: string | null;

  @Column({ name: 'acd_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  acdStatus: string;

  @CreateDateColumn({ name: 'acd_created_at' })
  acdCreatedAt: Date;

  @UpdateDateColumn({ name: 'acd_updated_at' })
  acdUpdatedAt: Date;

  @OneToMany(() => ProgramEntity, (p) => p.academy)
  programs: ProgramEntity[];

  @OneToMany(() => ClassroomEntity, (c) => c.academy)
  classrooms: ClassroomEntity[];

  @OneToMany(() => TeacherEntity, (t) => t.academy)
  teachers: TeacherEntity[];

  @OneToMany(() => ParentEntity, (p) => p.academy)
  parents: ParentEntity[];

  @OneToMany(() => UserEntity, (u) => u.academy)
  users: UserEntity[];
}
