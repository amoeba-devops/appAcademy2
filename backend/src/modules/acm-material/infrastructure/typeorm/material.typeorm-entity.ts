import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** PLN-260706 Phase 3 — a class material file (자료실 / 수업자료). */
@Entity('amb_acm_material')
@Index('idx_acm_material_cls', ['entId', 'clsId'], {
  where: 'deleted_at IS NULL',
})
export class MaterialTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mat_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  /** PLN-260718 P3 — nullable: portal teacher/student posts aren't class-bound. */
  @Column({ name: 'cls_id', type: 'uuid', nullable: true })
  clsId?: string | null;

  /**
   * PLN-260718 P3 — who authored the post. null for legacy class materials
   * uploaded from the admin console; STUDENT|TEACHER for portal posts;
   * ADMIN|STAFF for console posts that opt into the new model.
   */
  @Column({
    name: 'mat_author_kind',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  authorKind?: string | null;

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
