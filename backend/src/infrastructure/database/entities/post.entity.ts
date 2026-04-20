import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';

@Entity('tac_posts')
export class PostEntity {
  @PrimaryGeneratedColumn({ name: 'pst_id', type: 'bigint', unsigned: true })
  pstId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'pst_slug', type: 'varchar', length: 200 })
  pstSlug: string;

  @Column({ name: 'pst_title', type: 'varchar', length: 200 })
  pstTitle: string;

  @Column({ name: 'pst_body_md', type: 'mediumtext' })
  pstBodyMd: string;

  @Column({ name: 'pst_cover_image_url', type: 'varchar', length: 500, nullable: true })
  pstCoverImageUrl: string | null;

  @Column({ name: 'pst_author_user_id', type: 'bigint', unsigned: true, nullable: true })
  pstAuthorUserId: number | null;

  @Column({ name: 'pst_published_at', type: 'datetime', nullable: true })
  pstPublishedAt: Date | null;

  @Column({ name: 'pst_status', type: 'varchar', length: 20, default: 'DRAFT' })
  pstStatus: string;

  @Column({ name: 'pst_category', type: 'varchar', length: 30, default: 'NOTICE' })
  pstCategory: string;

  @CreateDateColumn({ name: 'pst_created_at' })
  pstCreatedAt: Date;

  @UpdateDateColumn({ name: 'pst_updated_at' })
  pstUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;
}
