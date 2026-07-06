import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** PLN-260706 Phase 3 — a class material file (자료실 / 수업자료). */
@Entity('amb_acm_material')
@Index('idx_acm_material_cls', ['entId', 'clsId'], { where: 'deleted_at IS NULL' })
export class MaterialTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mat_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  clsId!: string;

  @Column({ name: 'mat_title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'mat_s3_key', type: 'varchar', length: 300 })
  s3Key!: string;

  @Column({ name: 'mat_filename', type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'mat_mime', type: 'varchar', length: 120 })
  mime!: string;

  @Column({ name: 'mat_size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'mat_uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
