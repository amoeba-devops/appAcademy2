import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CstCapacityRole = 'PRIMARY' | 'GROUP_PEER';

@Entity('amb_acm_cls_class_students')
@Index('idx_acm_cls_cst_cls_idx', ['clsId'])
export class ClassStudentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cst_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  clsId!: string;

  @Column({ name: 'cst_student_user_id', type: 'uuid' })
  studentUserId!: string;

  /** PLN-260719 D — 시급 옵션화 (수업생성 폼에서 제거, 정산 NULL→0). */
  @Column({
    name: 'cst_hourly_rate',
    type: 'numeric',
    precision: 10,
    scale: 0,
    nullable: true,
  })
  hourlyRate?: string | null;

  @Column({
    name: 'cst_capacity_role',
    type: 'varchar',
    length: 15,
    default: 'PRIMARY',
  })
  capacityRole!: CstCapacityRole;

  @Column({ name: 'cst_enrolled_at', type: 'date' })
  enrolledAt!: string;

  @Column({ name: 'cst_left_at', type: 'date', nullable: true })
  leftAt?: string | null;

  @Column({ name: 'cst_inq_id', type: 'uuid', nullable: true })
  inqId?: string | null;

  @Column({ name: 'cst_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'cst_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
