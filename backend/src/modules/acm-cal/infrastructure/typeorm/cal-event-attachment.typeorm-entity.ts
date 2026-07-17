import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * PLN-260718 P2 — file attachments for a calendar event (수업/일정 첨부자료).
 * Distinct from the CSL attachment table (`amb_acm_csl_attachment`) which is
 * inquiry-scoped; this one is keyed by `evt_id` and shown to admins in the
 * event modal + to related portal users in the event detail page.
 *
 * S3 key layout: `cal-events/{ent_id}/{evt_id}/{cea_id}-{filename}`.
 * Caps: ≤20MB × ≤20 rows / event (Q-CAL-attach).
 */
@Entity('amb_acm_cal_event_attachment')
@Index('idx_acm_cal_att_evt', ['entId', 'evtId'])
export class CalEventAttachmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cea_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_id', type: 'uuid' })
  evtId!: string;

  @Column({ name: 'cea_s3_key', type: 'varchar', length: 500 })
  s3Key!: string;

  @Column({ name: 'cea_filename', type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'cea_mime', type: 'varchar', length: 100 })
  mime!: string;

  /** Size in bytes; CHECK enforces ≤20 MB. */
  @Column({ name: 'cea_size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'cea_uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
