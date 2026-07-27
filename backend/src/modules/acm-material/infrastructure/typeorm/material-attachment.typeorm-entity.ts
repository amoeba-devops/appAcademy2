import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * REQ-260728B FR-2 — 문서(DOC) 게시글 첨부파일 (amb_acm_material_attachment).
 *
 * DOC 게시글에 파일을 첨부한다 (문서당 ≤5개 × ≤50MB, 서비스에서 강제).
 * FILE 게시글은 자체가 파일이므로 첨부를 갖지 않는다. 열람 권한은 게시글의
 * canView 를, 추가/삭제 권한은 canEdit(작성자·EDITOR)를 상속한다.
 */
@Entity('amb_acm_material_attachment')
@Index('idx_acm_mat_attach_mat', ['entId', 'matId'], {
  where: 'deleted_at IS NULL',
})
export class MaterialAttachmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mta_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mat_id', type: 'uuid' })
  matId!: string;

  @Column({ name: 'mta_s3_key', type: 'varchar', length: 500 })
  s3Key!: string;

  @Column({ name: 'mta_filename', type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'mta_mime', type: 'varchar', length: 100, nullable: true })
  mime?: string | null;

  @Column({ name: 'mta_size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string | null;

  @Column({ name: 'mta_uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
