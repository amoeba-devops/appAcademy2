import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * PLN-260706 — portal login credential for a student / parent / teacher.
 *
 * `refId` points to the subject row per `kind`:
 *   STUDENT → amb_acm_std_student.std_id
 *   PARENT  → amb_acm_std_parent.par_id
 *   TEACHER → amb_acm_tch_teacher.tch_id
 *
 * The teacher's separate admin login (amb_acm_user, role=TEACHER) is
 * unchanged; this table backs the lightweight unified portal only.
 */
export type PortalKind = 'STUDENT' | 'PARENT' | 'TEACHER';
export type PortalAccountStatus = 'ACTIVE' | 'INACTIVE';

@Entity('amb_acm_portal_account')
@Unique('uq_acm_pac_login', ['entId', 'loginId'])
@Unique('uq_acm_pac_ref', ['entId', 'kind', 'refId'])
export class PortalAccountTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'pac_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'pac_kind', type: 'varchar', length: 10 })
  kind!: PortalKind;

  @Column({ name: 'pac_ref_id', type: 'uuid' })
  refId!: string;

  @Column({ name: 'pac_login_id', type: 'varchar', length: 40 })
  loginId!: string;

  @Column({ name: 'pac_password_hash', type: 'varchar', length: 120 })
  passwordHash!: string;

  @Column({ name: 'pac_must_change_password', type: 'boolean', default: true })
  mustChangePassword!: boolean;

  @Column({ name: 'pac_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: PortalAccountStatus;

  @Column({ name: 'pac_last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: 'pac_locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
