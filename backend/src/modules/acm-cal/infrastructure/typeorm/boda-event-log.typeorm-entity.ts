import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * BODA Webhook 원본 + 멱등 보장 로그.
 *
 * 동일 이벤트 재전송에 대비해 `(COALESCE(meet_idx, ''), event_code,
 * event_at, COALESCE(user_id, ''))` 에 **UNIQUE index** 를 걸어 중복을 DB
 * 레벨에서 거른다 (FR-EVENT-3). NULL 매칭을 UNIQUE 무시하지 않도록 COALESCE
 * 표현식 인덱스 사용 — DDL 은 [`910-acm-cal-boda.sql`](../../../../../sql/acm/910-acm-cal-boda.sql)
 * 에 정의.
 *
 * `payload` 는 BODA 가 보낸 원본 JSON 을 그대로 저장 (audit + 미지원 이벤트
 * 후속 처리용).
 */
@Entity('amb_acm_cal_boda_event_log')
@Index('idx_acm_boda_event_meet_key', ['meetKey'])
export class BodaEventLogTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'bel_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'bel_event_code', type: 'smallint' })
  eventCode!: number;

  @Column({
    name: 'bel_meet_idx',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  meetIdx?: string | null;

  @Column({
    name: 'bel_meet_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  meetKey?: string | null;

  @Column({ name: 'bel_event_at', type: 'timestamptz' })
  eventAt!: Date;

  @Column({ name: 'bel_user_id', type: 'varchar', length: 60, nullable: true })
  userId?: string | null;

  @Column({ name: 'bel_payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'bel_processed', type: 'boolean', default: false })
  processed!: boolean;

  @Column({ name: 'bel_processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ name: 'bel_error', type: 'varchar', length: 500, nullable: true })
  error?: string | null;

  @Column({ name: 'bel_src_ip', type: 'varchar', length: 45, nullable: true })
  srcIp?: string | null;

  @Column({
    name: 'bel_received_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  receivedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
