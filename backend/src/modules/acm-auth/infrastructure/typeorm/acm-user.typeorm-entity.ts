import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('amb_acm_user')
@Index('idx_acm_user_email_status', ['email', 'status'])
export class AcmUserTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'usr_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'usr_email', type: 'varchar', length: 200 })
  email!: string;

  @Column({ name: 'usr_password_hash', type: 'varchar', length: 120 })
  passwordHash!: string;

  @Column({ name: 'usr_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'usr_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'usr_last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
