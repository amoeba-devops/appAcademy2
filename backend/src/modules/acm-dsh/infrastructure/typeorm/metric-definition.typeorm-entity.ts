import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type MetCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';
export type MetAggregationType =
  | 'VOLUME_COUNT'
  | 'STATUS_SNAPSHOT'
  | 'DAILY_DISTINCT'
  | 'NET_DELTA'
  | 'COMPUTED';
export type MetDataSource =
  | 'MANUAL'
  | 'CSL'
  | 'CLS'
  | 'SCH'
  | 'REF'
  | 'QNA'
  | 'AMB_USERS'
  | 'EXTERNAL';

@Entity('amb_acm_dsh_metric_definitions')
export class MetricDefinitionTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'met_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'met_code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'met_category', type: 'varchar', length: 20 })
  category!: MetCategory;

  @Column({ name: 'met_label_kr', type: 'varchar', length: 50 })
  labelKr!: string;

  @Column({ name: 'met_label_en', type: 'varchar', length: 50 })
  labelEn!: string;

  @Column({ name: 'met_aggregation_type', type: 'varchar', length: 20 })
  aggregationType!: MetAggregationType;

  @Column({ name: 'met_data_source', type: 'varchar', length: 20 })
  dataSource!: MetDataSource;

  @Column({ name: 'met_unit', type: 'varchar', length: 20, nullable: true })
  unit?: string | null;

  @Column({ name: 'met_format', type: 'varchar', length: 50, nullable: true })
  format?: string | null;

  @Column({ name: 'met_display_order_in_category', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'met_dashboard_visible', type: 'boolean', default: true })
  dashboardVisible!: boolean;

  @Column({ name: 'met_supports_drill_down', type: 'boolean', default: false })
  supportsDrillDown!: boolean;

  @Column({ name: 'met_active', type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
