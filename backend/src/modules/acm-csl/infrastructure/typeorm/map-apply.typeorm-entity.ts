import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** CSL-PLN-260916 — 맵테스트 신청 출처. */
export const MAP_APPLY_ORIGINS = ['WEB', 'IMPORT', 'CONSOLE'] as const;
export type MapApplyOrigin = (typeof MAP_APPLY_ORIGINS)[number];

export const MAP_APPLY_GENDERS = ['M', 'F'] as const;
export type MapApplyGender = (typeof MAP_APPLY_GENDERS)[number];

/**
 * CSL-PLN-260916 — 맵테스트 신청서 원본 (`amb_acm_csl_map_apply`).
 *
 * 상담(`amb_acm_csl_inquiry`) 1건과 1:1. 학생 한글이름·연락처·학부모 이메일·학년은
 * 상담 레코드가 소유(암호화)하고, 이 테이블은 맵테스트 신청 고유 항목만 보존한다.
 */
@Entity('amb_acm_csl_map_apply')
@Index('idx_acm_csl_map_apply_ent_submitted', ['entId', 'submittedAt'])
export class MapApplyTypeormEntity {
  @PrimaryColumn({ name: 'mpa_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  /** 실제 접수 시각. 이관 건은 아임웹 작성시각. */
  @Column({ name: 'mpa_submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @Column({
    name: 'mpa_student_name_en',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  studentNameEn?: string | null;

  /** 정규화 성공 시 YYYY-MM-DD */
  @Column({ name: 'mpa_birthdate', type: 'date', nullable: true })
  birthdate?: string | null;

  /** 정규화 실패 시 입력 원문 */
  @Column({
    name: 'mpa_birthdate_raw',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  birthdateRaw?: string | null;

  @Column({ name: 'mpa_gender', type: 'varchar', length: 10, nullable: true })
  gender?: MapApplyGender | null;

  @Column({
    name: 'mpa_exam_location',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  examLocation?: string | null;

  @Column({
    name: 'mpa_preferred_slot',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  preferredSlot?: string | null;

  @Column({ name: 'mpa_source_site', type: 'varchar', length: 20 })
  sourceSite!: string;

  @Column({
    name: 'mpa_origin',
    type: 'varchar',
    length: 20,
    default: 'WEB',
  })
  origin!: MapApplyOrigin;

  /** 이관 멱등 키: `<site>|<작성시각 ISO>|<학생 한글이름>` */
  @Column({
    name: 'mpa_import_key',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  importKey?: string | null;

  @Column({ name: 'mpa_raw_payload', type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
