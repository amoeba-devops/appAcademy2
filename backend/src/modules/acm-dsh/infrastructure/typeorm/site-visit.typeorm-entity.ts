import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * PLN-260912 — 사이트별 일자 방문 통계 (GA4 동기화 결과).
 * (ent_id, svt_site, svt_date) 유일. daily_kpi.dkp_marketing_visitor 는 이 표의 합.
 */
@Entity('amb_acm_dsh_site_visit')
@Index('uq_acm_dsh_svt_site_date', ['entId', 'site', 'date'], { unique: true })
export class SiteVisitTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'svt_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'svt_site', type: 'varchar', length: 20 })
  site!: string;

  @Column({ name: 'svt_date', type: 'date' })
  date!: string;

  @Column({ name: 'svt_visitors', type: 'int', default: 0 })
  visitors!: number;

  @Column({ name: 'svt_sessions', type: 'int', nullable: true })
  sessions?: number | null;

  @Column({ name: 'svt_pageviews', type: 'int', nullable: true })
  pageviews?: number | null;

  @Column({ name: 'svt_source', type: 'varchar', length: 20, default: 'GA4' })
  source!: string;

  @Column({
    name: 'svt_synced_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  syncedAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
