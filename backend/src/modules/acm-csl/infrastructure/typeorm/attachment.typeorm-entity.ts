import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * REQ-260626 — single attachment table for the CSL pipeline.
 * @see docs/design/DSN-260626-acm-csl-pipeline-revision.md §3.2 / sql/acm/985 §5
 *
 * Category routing:
 *   TRANSCRIPT  — uploaded at INTAKE (operator), STAFF_ONLY visibility (POL-CSL-203)
 *   MATERIAL    — uploaded at DEMO   (operator), TEACHER_STUDENT visibility
 *   RESULT_PDF  — cached level-test result PDF (optional)
 */
export type AttachmentCategory = 'TRANSCRIPT' | 'MATERIAL' | 'RESULT_PDF';
export type AttachmentVisibility = 'STAFF_ONLY' | 'TEACHER_STUDENT';
export type AttachmentMime = 'application/pdf' | 'image/jpeg' | 'image/png';

@Entity('amb_acm_csl_attachment')
@Index('idx_acm_csl_att_inq_category', ['entId', 'inqId', 'category'])
@Index('idx_acm_csl_att_ref', ['refId'])
export class AttachmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'att_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  @Column({ name: 'att_category', type: 'varchar', length: 20 })
  category!: AttachmentCategory;

  /** e.g. tcl_id for MATERIAL, mpt_id for RESULT_PDF; nullable for TRANSCRIPT. */
  @Column({ name: 'att_ref_id', type: 'uuid', nullable: true })
  refId?: string | null;

  @Column({ name: 'att_s3_key', type: 'varchar', length: 500 })
  s3Key!: string;

  @Column({ name: 'att_filename', type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'att_mime', type: 'varchar', length: 100 })
  mime!: AttachmentMime;

  /** Size in bytes; CHECK enforces ≤10 MB (Q-CSL-106). */
  @Column({ name: 'att_size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'att_visibility', type: 'varchar', length: 20, default: 'STAFF_ONLY' })
  visibility!: AttachmentVisibility;

  @Column({ name: 'att_uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
