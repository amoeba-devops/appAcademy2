import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ACM 보관 상태.
 *   PENDING   — 보다 목록/이벤트로 존재를 알았고 아직 복사 전
 *   ARCHIVING — 복사 진행 중 (워커 점유)
 *   ARCHIVED  — ACM S3 복사 완료 → 콘솔은 ACM 프록시로 재생/다운로드
 *   FAILED    — 복사 실패 (attempts 소진 시 중단, 보다 직프록시로 폴백)
 *   MISSING   — 보다 측 fileExist=false (파일 없음)
 */
export type BodaRecordingArchiveStatus =
  | 'PENDING'
  | 'ARCHIVING'
  | 'ARCHIVED'
  | 'FAILED'
  | 'MISSING';

/**
 * REQ-260912B — 보다스쿨 녹화본 메타 + ACM 서버 보관 레코드.
 *
 * 보다 SERVER API 는 Basic 인증 다운로드만 제공하고 공개 재생 URL 이 없다
 * (SPEC_823 v823.002). 파일을 ACM S3 로 복사해 두고 Range 프록시로 서빙한다.
 *
 * @see sql/acm/999l-acm-cal-boda-recording.sql
 */
@Entity('amb_acm_cal_boda_recording')
@Index('uq_acm_cal_bdv_ent_record', ['entId', 'recordIdx'], { unique: true })
@Index('idx_acm_cal_bdv_evt', ['entId', 'evtId', 'recordIdx'])
export class BodaRecordingTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'bdv_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_id', type: 'uuid' })
  evtId!: string;

  @Column({ name: 'bdr_id', type: 'uuid', nullable: true })
  roomId!: string | null;

  @Column({ name: 'bdv_record_idx', type: 'int' })
  recordIdx!: number;

  @Column({ name: 'bdv_meet_idx', type: 'varchar', length: 60, nullable: true })
  meetIdx!: string | null;

  @Column({
    name: 'bdv_room_code',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  roomCode!: string | null;

  @Column({ name: 'bdv_title', type: 'varchar', length: 256, nullable: true })
  title!: string | null;

  @Column({ name: 'bdv_started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'bdv_ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'bdv_duration_sec', type: 'int', nullable: true })
  durationSec!: number | null;

  @Column({ name: 'bdv_file_exist', type: 'boolean', default: true })
  fileExist!: boolean;

  @Column({
    name: 'bdv_archive_status',
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  archiveStatus!: BodaRecordingArchiveStatus;

  @Column({ name: 'bdv_s3_key', type: 'varchar', length: 400, nullable: true })
  s3Key!: string | null;

  @Column({ name: 'bdv_mime', type: 'varchar', length: 100, nullable: true })
  mime!: string | null;

  /** BIGINT — pg 드라이버가 문자열로 돌려준다 (attachment 와 동일 규약). */
  @Column({ name: 'bdv_size_bytes', type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  @Column({ name: 'bdv_archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'bdv_attempts', type: 'smallint', default: 0 })
  attempts!: number;

  @Column({ name: 'bdv_error', type: 'varchar', length: 500, nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
