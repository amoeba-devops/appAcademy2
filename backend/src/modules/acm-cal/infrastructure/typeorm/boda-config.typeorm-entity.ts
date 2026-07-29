import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BODA(보다에듀) 화상 강의실 연동 — 테넌트별 설정.
 *
 * 1 row per (ent_id). 자격증명 (`authKey`, `eventSecret`) 은 AES-GCM 으로
 * BYTEA 저장 — TypeORM 측에서는 `Buffer` 로 매핑. SELECT 응답을 그대로 클라이언트
 * 에 노출하면 안 됨 (FR-BODA-CFG-3 / NFR-3).
 *
 * @see docs/analysis/REQ-260526-acm-cal-boda-integration.md §5.1
 * @see sql/acm/910-acm-cal-boda.sql
 */
@Entity('amb_acm_cal_boda_config')
@Index('uq_acm_boda_config_ent', ['entId'], { unique: true })
export class BodaConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'bdc_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  // ── 공개 URL / 식별자 ──────────────────────────────────────────────
  @Column({ name: 'bdc_boda_web_url', type: 'varchar', length: 255 })
  bodaWebUrl!: string;

  @Column({ name: 'bdc_svr_url', type: 'varchar', length: 255 })
  svrUrl!: string;

  @Column({ name: 'bdc_webrtc_url', type: 'varchar', length: 255 })
  webrtcUrl!: string;

  @Column({ name: 'bdc_company_code', type: 'varchar', length: 30 })
  companyCode!: string;

  @Column({ name: 'bdc_company_id', type: 'varchar', length: 60 })
  companyId!: string;

  @Column({ name: 'bdc_default_room_code', type: 'varchar', length: 30 })
  defaultRoomCode!: string;

  /**
   * 1:N(그룹) 수업용 roomCode. 벤더 발급값(TPI = 881). null 이면 1:N 개설 불가
   * (createPending 이 422 BODA_GROUP_ROOM_CODE_MISSING). @see FIX-260724
   */
  @Column({
    name: 'bdc_group_room_code',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  groupRoomCode?: string | null;

  // ── 비밀 (BYTEA, AES-GCM 암호화) ───────────────────────────────────
  // Direct DB column reads return Buffer; service layer decrypts before use.
  @Column({ name: 'bdc_auth_key_enc', type: 'bytea', nullable: true })
  authKeyEnc?: Buffer | null;

  @Column({ name: 'bdc_event_secret_enc', type: 'bytea', nullable: true })
  eventSecretEnc?: Buffer | null;

  // ── 운영 옵션 ──────────────────────────────────────────────────────
  @Column({
    name: 'bdc_webhook_allow_cidrs',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  webhookAllowCidrs?: string | null;

  @Column({ name: 'bdc_grace_before_min', type: 'smallint', default: 10 })
  graceBeforeMin!: number;

  @Column({ name: 'bdc_grace_after_min', type: 'smallint', default: 15 })
  graceAfterMin!: number;

  @Column({ name: 'bdc_reconcile_delay_min', type: 'smallint', default: 10 })
  reconcileDelayMin!: number;

  @Column({ name: 'bdc_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
