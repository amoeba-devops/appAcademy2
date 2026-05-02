import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('amb_acm_sch_grade_band')
@Index('idx_acm_sch_gbd_ent_sch', ['entId', 'schId'])
export class GradeBandTypeormEntity {
  @PrimaryColumn({ name: 'gbd_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'sch_id', type: 'uuid' })
  schId!: string;

  @Column({ name: 'gbd_label', type: 'varchar', length: 80 })
  label!: string;

  @Column({ name: 'gbd_grade_min', type: 'smallint' })
  gradeMin!: number;

  @Column({ name: 'gbd_grade_max', type: 'smallint' })
  gradeMax!: number;

  @Column({ name: 'gbd_note', type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
