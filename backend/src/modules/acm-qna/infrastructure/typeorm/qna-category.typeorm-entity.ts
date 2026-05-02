import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('amb_acm_qna_category')
@Index('idx_acm_qna_category_ent_active', ['entId', 'isActive'])
export class QnaCategoryTypeormEntity {
  @PrimaryColumn({ name: 'qct_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'qct_code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'qct_label_kr', type: 'varchar', length: 100 })
  labelKr!: string;

  @Column({ name: 'qct_label_en', type: 'varchar', length: 100, nullable: true })
  labelEn?: string | null;

  @Column({ name: 'qct_label_vi', type: 'varchar', length: 100, nullable: true })
  labelVi?: string | null;

  @Column({ name: 'qct_label_zh', type: 'varchar', length: 100, nullable: true })
  labelZh?: string | null;

  @Column({ name: 'qct_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'qct_sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
