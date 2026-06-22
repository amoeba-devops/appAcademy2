import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PostCategory = 'NOTICE' | 'EVENT' | 'RESULT';

/** @see sql/acm/970-acm-posts-schema.sql §1 — 학원 게시판 */
@Entity('amb_acm_post')
@Index('uq_acm_post_ent_slug', ['entId', 'slug'], { unique: true })
@Index('idx_acm_post_published', ['entId', 'status', 'publishedAt'])
@Index('idx_acm_post_ent_cat_pub', ['entId', 'category', 'status', 'publishedAt'])
export class PostTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'pst_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'pst_slug', type: 'varchar', length: 200 })
  slug!: string;

  @Column({ name: 'pst_title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'pst_body_md', type: 'text' })
  bodyMd!: string;

  @Column({ name: 'pst_cover_image_url', type: 'varchar', length: 500, nullable: true })
  coverImageUrl?: string | null;

  @Column({ name: 'pst_author_user_id', type: 'uuid', nullable: true })
  authorUserId?: string | null;

  @Column({ name: 'pst_published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'pst_status', type: 'varchar', length: 20, default: 'DRAFT' })
  status!: PostStatus;

  @Column({ name: 'pst_category', type: 'varchar', length: 30, default: 'NOTICE' })
  category!: PostCategory;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
