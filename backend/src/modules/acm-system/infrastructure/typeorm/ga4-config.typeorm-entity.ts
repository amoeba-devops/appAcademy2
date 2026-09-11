import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const GA4_METRICS = ['activeUsers', 'totalUsers', 'sessions'] as const;
export type Ga4Metric = (typeof GA4_METRICS)[number];

export const GA4_SITES = ['TPI', 'TRINITY', 'SANTACROCE'] as const;
export type Ga4Site = (typeof GA4_SITES)[number];

/**
 * PLN-260912 — 테넌트별 GA4 Data API 설정. ent당 1행.
 * gac_sa_key_enc: 서비스계정 JSON 전체를 AES-256-GCM [iv(12)][authTag(16)][ciphertext] BYTEA 로 저장.
 */
@Entity('amb_acm_ga4_config')
@Index('uq_acm_ga4_config_ent', ['entId'], { unique: true })
export class Ga4ConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'gac_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({
    name: 'gac_property_id',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  propertyId?: string | null;

  /** site code → GA4 data stream id */
  @Column({
    name: 'gac_stream_map',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  streamMap!: Record<string, string>;

  @Column({
    name: 'gac_sa_email',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  saEmail?: string | null;

  @Column({ name: 'gac_sa_key_enc', type: 'bytea', nullable: true })
  saKeyEnc?: Buffer | null;

  @Column({
    name: 'gac_metric',
    type: 'varchar',
    length: 20,
    default: 'activeUsers',
  })
  metric!: Ga4Metric;

  @Column({ name: 'gac_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'gac_last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt?: Date | null;

  @Column({
    name: 'gac_last_sync_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  lastSyncStatus?: string | null;

  @Column({ name: 'gac_last_sync_error', type: 'text', nullable: true })
  lastSyncError?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
