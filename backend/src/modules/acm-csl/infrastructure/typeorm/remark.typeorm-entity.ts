import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Timeline note (free-form remark) per inquiry.
 * @see C-26, C-27, FR-CSL-F11
 */
@Entity('amb_acm_csl_remark')
@Index('idx_acm_csl_remark_inq_created', ['inqId', 'createdAt'])
export class RemarkTypeormEntity {
  @PrimaryColumn({ name: 'rmk_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
