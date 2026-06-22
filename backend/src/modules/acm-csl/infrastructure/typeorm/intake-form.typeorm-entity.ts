import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InquiryTypeormEntity } from './inquiry.typeorm-entity';

const numericTransformer = {
  to: (n: number | null | undefined): string | null =>
    n == null ? null : n.toFixed(2),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

export type IntakeFormStatus = 'NEW' | 'PROMOTED' | 'SPAM' | 'DUPLICATE';

/**
 * 포털 공개 상담 신청 폼 (CAPTCHA + 개인정보 동의).
 *
 * Orphan today — schema 보존 for v1.1 revival. PII (parent_name, phone,
 * email) 는 본 row 에 평문이지만 portal-side rate limit + CAPTCHA + status
 * gate (NEW → PROMOTED) 로 보호. PROMOTED 시 cif_promoted_inq_id 채워짐.
 *
 * @see sql/acm/975-acm-csl-aux.sql §2
 */
@Entity('amb_acm_csl_intake_form')
@Index('idx_acm_csl_intake_form_ent_status', ['entId', 'status', 'createdAt'])
export class IntakeFormTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cif_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cif_parent_name', type: 'varchar', length: 100 })
  parentName!: string;

  @Column({ name: 'cif_phone', type: 'varchar', length: 30 })
  phone!: string;

  @Column({ name: 'cif_email', type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ name: 'cif_child_grade', type: 'varchar', length: 20, nullable: true })
  childGrade?: string | null;

  @Column({ name: 'cif_program_interest', type: 'varchar', length: 100, nullable: true })
  programInterest?: string | null;

  @Column({ name: 'cif_preferred_date', type: 'date', nullable: true })
  preferredDate?: string | null;

  @Column({ name: 'cif_message', type: 'text', nullable: true })
  message?: string | null;

  @Column({ name: 'cif_is_consent_pi', type: 'boolean', default: false })
  isConsentPi!: boolean;

  /** reCAPTCHA v3 score (0.0 ~ 1.0). */
  @Column({
    name: 'cif_captcha_score',
    type: 'numeric',
    precision: 3,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  captchaScore?: number | null;

  @Column({ name: 'cif_ip', type: 'varchar', length: 45, nullable: true })
  ip?: string | null;

  @Column({ name: 'cif_user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'cif_status', type: 'varchar', length: 20, default: 'NEW' })
  status!: IntakeFormStatus;

  @Column({ name: 'cif_promoted_inq_id', type: 'uuid', nullable: true })
  promotedInquiryId?: string | null;

  @ManyToOne(() => InquiryTypeormEntity, { nullable: true })
  @JoinColumn({ name: 'cif_promoted_inq_id', referencedColumnName: 'id' })
  promotedInquiry?: InquiryTypeormEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
