import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * REQ-260621 v1.1 — per-tenant admin-menu visibility (amb_acm_tenant_menu).
 * Absence of a row for (entId, menuKey) means VISIBLE. Only overrides stored.
 */
@Entity('amb_acm_tenant_menu')
@Index('idx_acm_tenant_menu_ent', ['entId'])
export class AcmTenantMenuTypeormEntity {
  @PrimaryColumn({ name: 'tnm_ent_id', type: 'uuid' })
  entId!: string;

  @PrimaryColumn({ name: 'tnm_menu_key', type: 'varchar', length: 40 })
  menuKey!: string;

  @Column({ name: 'tnm_visible', type: 'boolean', default: true })
  visible!: boolean;

  /** PLN-260728E — admin 사이드바 표시 순서(기본=ALL_MENU_KEYS 인덱스). null=기본. */
  @Column({ name: 'tnm_order', type: 'smallint', nullable: true })
  order?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
