import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';

@Entity('tac_users')
export class UserEntity {
  @PrimaryGeneratedColumn({ name: 'usr_id', type: 'bigint', unsigned: true })
  usrId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'usr_email', type: 'varchar', length: 200 })
  usrEmail: string;

  @Column({ name: 'usr_password', type: 'varchar', length: 200 })
  usrPassword: string;

  @Column({ name: 'usr_name', type: 'varchar', length: 100 })
  usrName: string;

  @Column({ name: 'usr_role', type: 'varchar', length: 20, default: 'STAFF' })
  usrRole: string;

  @Column({ name: 'usr_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  usrStatus: string;

  @Column({ name: 'usr_last_login_at', type: 'datetime', nullable: true })
  usrLastLoginAt: Date | null;

  @CreateDateColumn({ name: 'usr_created_at' })
  usrCreatedAt: Date;

  @UpdateDateColumn({ name: 'usr_updated_at' })
  usrUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity, (a) => a.users)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;
}
