import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { UserEntity } from './user.entity';

@Entity('tac_audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ name: 'adl_id', type: 'bigint', unsigned: true })
  adlId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'adl_user_id', type: 'bigint', unsigned: true, nullable: true })
  adlUserId: number | null;

  @Column({ name: 'adl_action', type: 'varchar', length: 50 })
  adlAction: string;

  @Column({ name: 'adl_entity_type', type: 'varchar', length: 50 })
  adlEntityType: string;

  @Column({ name: 'adl_entity_id', type: 'bigint', unsigned: true })
  adlEntityId: number;

  @Column({ name: 'adl_field_name', type: 'varchar', length: 100, nullable: true })
  adlFieldName: string | null;

  @Column({ name: 'adl_old_value', type: 'text', nullable: true })
  adlOldValue: string | null;

  @Column({ name: 'adl_new_value', type: 'text', nullable: true })
  adlNewValue: string | null;

  @Column({ name: 'adl_ip', type: 'varchar', length: 45, nullable: true })
  adlIp: string | null;

  @Column({ name: 'adl_user_agent', type: 'varchar', length: 500, nullable: true })
  adlUserAgent: string | null;

  @Column({ name: 'adl_reason', type: 'varchar', length: 200, nullable: true })
  adlReason: string | null;

  @CreateDateColumn({ name: 'adl_created_at' })
  adlCreatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'adl_user_id' })
  user: UserEntity;
}
