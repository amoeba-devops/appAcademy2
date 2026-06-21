import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** REQ-260621 v1.1 — ACM tenant registry (amb_acm_tenant). */
@Entity('amb_acm_tenant')
export class AcmTenantTypeormEntity {
  @PrimaryColumn({ name: 'tnt_ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tnt_name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'tnt_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';

  @Column({ name: 'tnt_is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
