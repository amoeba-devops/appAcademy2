import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { AcademyEntity } from './academy.entity';

/**
 * tac_user_academies — User ↔ Academy 멤버십 (M:N).
 * AMA App Store pivot 으로 1인 다(多) 학원 운영 시나리오 지원.
 */
@Entity('tac_user_academies')
@Unique('uq_tac_user_academies', ['usrId', 'acdId'])
@Index('idx_tac_user_academies_acd_status', ['acdId', 'uamStatus'])
@Index('idx_tac_user_academies_usr_status', ['usrId', 'uamStatus'])
export class UserAcademyEntity {
  @PrimaryGeneratedColumn({ name: 'uam_id', type: 'bigint', unsigned: true })
  uamId: number;

  @Column({ name: 'usr_id', type: 'bigint', unsigned: true })
  usrId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  /** OWNER / ADMIN / STAFF / READONLY */
  @Column({ name: 'uam_role', type: 'varchar', length: 20, default: 'STAFF' })
  uamRole: string;

  /** INVITED / ACTIVE / SUSPENDED / REMOVED */
  @Column({ name: 'uam_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  uamStatus: string;

  @Column({ name: 'uam_invited_at', type: 'datetime', nullable: true })
  uamInvitedAt: Date | null;

  @Column({ name: 'uam_accepted_at', type: 'datetime', nullable: true })
  uamAcceptedAt: Date | null;

  @Column({ name: 'uam_revoked_at', type: 'datetime', nullable: true })
  uamRevokedAt: Date | null;

  @CreateDateColumn({ name: 'uam_created_at' })
  uamCreatedAt: Date;

  @UpdateDateColumn({ name: 'uam_updated_at' })
  uamUpdatedAt: Date;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'usr_id' })
  user: UserEntity;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;
}
