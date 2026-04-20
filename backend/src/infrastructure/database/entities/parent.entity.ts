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
import { StudentEntity } from './student.entity';
import { StudentGuardianEntity } from './student-guardian.entity';

@Entity('tac_parents')
export class ParentEntity {
  @PrimaryGeneratedColumn({ name: 'prt_id', type: 'bigint', unsigned: true })
  prtId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'prt_name', type: 'varchar', length: 100 })
  prtName: string;

  @Column({ name: 'prt_phone_encrypted', type: 'varbinary', length: 255, nullable: true })
  prtPhoneEncrypted: Buffer | null;

  @Column({ name: 'prt_email_encrypted', type: 'varbinary', length: 255, nullable: true })
  prtEmailEncrypted: Buffer | null;

  @Column({ name: 'prt_preferred_channel', type: 'varchar', length: 20, nullable: true, default: 'SMS' })
  prtPreferredChannel: string | null;

  @CreateDateColumn({ name: 'prt_created_at' })
  prtCreatedAt: Date;

  @UpdateDateColumn({ name: 'prt_updated_at' })
  prtUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity, (a) => a.parents)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @OneToMany(() => StudentEntity, (s) => s.primaryParent)
  students: StudentEntity[];

  @OneToMany(() => StudentGuardianEntity, (sg) => sg.parent)
  guardianships: StudentGuardianEntity[];
}
