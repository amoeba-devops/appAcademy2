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

  /** PLN-260719 B — 'FILE'(파일 자료) | 'DOC'(리치에디터 문서 게시글). */
  @Column({ name: 'mat_kind', type: 'varchar', length: 10, default: 'FILE' })
  kind!: 'FILE' | 'DOC';

  /** PLN-260719 B — DOC 본문 HTML (렌더 시 sanitize). FILE 은 null. */
  @Column({ name: 'mat_content', type: 'text', nullable: true })
  content?: string | null;

  @Column({ name: 'mat_title', type: 'varchar', length: 200 })
  title!: string;

  // PLN-260719 B — DOC 행은 파일 메타가 없으므로 nullable (999e).
  @Column({ name: 'mat_s3_key', type: 'varchar', length: 300, nullable: true })
  s3Key?: string | null;

  @Column({
    name: 'mat_filename',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  filename?: string | null;

  @Column({ name: 'mat_mime', type: 'varchar', length: 120, nullable: true })
  mime?: string | null;

  @Column({ name: 'mat_size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string | null;

  @Column({ name: 'mat_uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
