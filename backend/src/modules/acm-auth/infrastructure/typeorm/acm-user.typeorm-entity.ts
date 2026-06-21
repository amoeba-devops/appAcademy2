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

  @Column({ name: 'usr_password_hash', type: 'varchar', length: 120, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'usr_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'usr_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'usr_role', type: 'varchar', length: 20, default: 'ADMIN' })
  role!: 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN';

  @Column({ name: 'usr_last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: 'usr_locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;

  /**
   * REQ-260621 — forces a password change on next authenticated use. Set on
   * seed/admin-reset; cleared by the user's own change-password. While true,
   * privileged surfaces (e.g. /acm/system/*) are blocked by
   * RequirePasswordRotationGuard.
   */
  @Column({ name: 'usr_must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ name: 'auth_source', type: 'varchar', length: 16, default: 'local' })
  authSource!: string;

  @Column({ name: 'ama_user_id', type: 'uuid', nullable: true })
  amaUserId?: string | null;

  @Column({ name: 'ama_entity_id', type: 'uuid', nullable: true })
  amaEntityId?: string | null;

  @Column({ name: 'ama_role', type: 'varchar', length: 40, nullable: true })
  amaRole?: string | null;

  /** AMA job/position field (e.g. 'TEACHER') — basis for TEACHER/STAFF mapping (REQ-260609 FR-B). */
  @Column({ name: 'usr_ama_job_role', type: 'varchar', length: 40, nullable: true })
  amaJobRole?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
