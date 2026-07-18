import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ClsEnrollmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELED'
  | 'EXPIRED';

/**
 * Student × Class enrollment (REQ-260622 model decision X).
 *
 * Separate from `amb_acm_csl_enrollment` which is a counseling pipeline
 * stage marker (FK → inquiry). This table is the actual student-enrolled-
 * in-class record.
 *
 * @see sql/acm/952-acm-cls-enrollment.sql
 * @see docs/analysis/REQ-260622 §2.1 (decision X)
 *
 * Tenant guard: ent_id required on every query (OwnEntityGuard pattern).
 */
@Entity('amb_acm_cls_enrollment')
@Index('uq_acm_cls_enrollment_cls_std', ['classId', 'studentId'], {
  unique: true,
})
@Index('idx_acm_cls_enrollment_ent_status', ['entId', 'status'])
@Index('idx_acm_cls_enrollment_std_status', ['studentId', 'status'])
@Index('idx_acm_cls_enrollment_cls_status', ['classId', 'status'])
export class ClsEnrollmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ce_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  classId!: string;

  @Column({ name: 'std_id', type: 'uuid' })
  studentId!: string;

  /** 신청 보호자. */
  @Column({ name: 'ce_applied_prt_id', type: 'uuid' })
  appliedParentId!: string;

  @Column({
    name: 'ce_status',
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  status!: ClsEnrollmentStatus;

  @Column({ name: 'ce_applied_at', type: 'timestamptz' })
  appliedAt!: Date;

  @Column({ name: 'ce_confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  @Column({ name: 'ce_canceled_at', type: 'timestamptz', nullable: true })
  canceledAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
