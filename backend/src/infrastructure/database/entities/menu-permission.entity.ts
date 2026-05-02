import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('tac_menu_permissions')
@Index('uq_tac_menu_permissions_acd_menu_role', ['acdId', 'mnpMenuKey', 'mnpRole'], { unique: true })
export class MenuPermissionEntity {
  @PrimaryGeneratedColumn({ name: 'mnp_id', type: 'bigint', unsigned: true })
  mnpId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'mnp_menu_key', type: 'varchar', length: 40 })
  mnpMenuKey: string;

  @Column({ name: 'mnp_role', type: 'varchar', length: 20 })
  mnpRole: string;

  @Column({ name: 'mnp_visible', type: 'tinyint', width: 1, default: 1 })
  mnpVisible: number;

  @Column({ name: 'mnp_accessible', type: 'tinyint', width: 1, default: 1 })
  mnpAccessible: number;

  @CreateDateColumn({ name: 'mnp_created_at', type: 'datetime' })
  mnpCreatedAt: Date;

  @UpdateDateColumn({ name: 'mnp_updated_at', type: 'datetime' })
  mnpUpdatedAt: Date;
}
