import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** REQ-260903B — 학생↔담당강사 N:M. st_sort_order 0 = 대표(첫번째) 강사. */
@Entity('amb_acm_std_student_teacher')
@Unique('uq_acm_std_st_pair', ['stdId', 'tchId'])
@Index('idx_acm_std_st_ent_tch', ['entId', 'tchId'])
export class StudentTeacherTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'st_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'std_id', type: 'uuid' })
  stdId!: string;

  @Column({ name: 'tch_id', type: 'uuid' })
  tchId!: string;

  @Column({ name: 'st_sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
