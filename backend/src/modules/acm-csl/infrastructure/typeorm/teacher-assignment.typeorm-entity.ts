import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * REQ-260626 FR-CSL-136 — multi-teacher primary assignment recorded at the
 * enrollment counseling stage. UNIQUE(inq_id, tch_id) — same teacher cannot
 * be assigned twice on the same inquiry. PRIMARY/SECONDARY captures the
 * role distinction the operator surfaces in the UI.
 * @see sql/acm/985 §6
 */
export type AssignmentRole = 'PRIMARY' | 'SECONDARY';

@Entity('amb_acm_csl_teacher_assignment')
@Index('idx_acm_csl_asg_inq', ['entId', 'inqId'])
@Index('uq_acm_csl_asg_inq_tch', ['inqId', 'teacherId'], { unique: true })
export class TeacherAssignmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'asg_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  @Column({ name: 'tch_id', type: 'uuid' })
  teacherId!: string;

  @Column({ name: 'asg_role', type: 'varchar', length: 20, default: 'PRIMARY' })
  role!: AssignmentRole;

  @Column({ name: 'asg_assigned_by', type: 'uuid', nullable: true })
  assignedBy?: string | null;

  @CreateDateColumn({ name: 'asg_assigned_at', type: 'timestamptz' })
  assignedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
