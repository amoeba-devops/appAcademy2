import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TchAttachmentKind = 'RESUME' | 'CERTIFICATE' | 'OTHER';

@Entity('amb_acm_tch_attachment')
@Index('idx_acm_tch_att_ent_tch', ['entId', 'tchId'], { where: 'deleted_at IS NULL' })
export class TeacherAttachmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'att_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tch_id', type: 'uuid' })
  tchId!: string;

  @Column({ name: 'att_original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'att_mime', type: 'varchar', length: 100 })
  mime!: string;

  @Column({ name: 'att_size_bytes', type: 'bigint' })
  sizeBytes!: string; // bigint comes back as string from pg driver

  @Column({ name: 'att_storage_path', type: 'varchar', length: 500 })
  storagePath!: string;

  @Column({ name: 'att_kind', type: 'varchar', length: 30, default: 'RESUME' })
  kind!: TchAttachmentKind;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
