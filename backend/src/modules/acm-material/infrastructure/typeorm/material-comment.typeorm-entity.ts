import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * PLN-260718 P3 — flat comment on a material post (자료 댓글).
 * Anyone who can view the material (author or share target) may comment.
 * author_kind ∈ STUDENT|TEACHER|PARENT|ADMIN|STAFF; author_ref_id is the
 * portal ref (std_id/tch_id/par_id) or acm_user id for console authors.
 */
export type MaterialCommentAuthorKind =
  | 'STUDENT'
  | 'TEACHER'
  | 'PARENT'
  | 'ADMIN'
  | 'STAFF';

@Entity('amb_acm_material_comment')
@Index('idx_acm_material_comment_mat', ['entId', 'matId'], {
  where: 'deleted_at IS NULL',
})
export class MaterialCommentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mcm_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mat_id', type: 'uuid' })
  matId!: string;

  @Column({ name: 'mcm_author_kind', type: 'varchar', length: 20 })
  authorKind!: MaterialCommentAuthorKind;

  @Column({ name: 'mcm_author_ref_id', type: 'uuid' })
  authorRefId!: string;

  @Column({ name: 'mcm_author_name', type: 'varchar', length: 100 })
  authorName!: string;

  @Column({ name: 'mcm_body', type: 'text' })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
