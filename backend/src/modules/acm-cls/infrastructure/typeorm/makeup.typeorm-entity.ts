import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type MakeupStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CARRIED_OVER'
  | 'REJECTED';

@Entity('amb_acm_cls_makeups')
@Index('idx_acm_cls_mkp_status_idx', ['entId', 'status'])
export class MakeupTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mkp_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mkp_original_ses_id', type: 'uuid' })
  originalSesId!: string;

  @Column({ name: 'mkp_makeup_ses_id', type: 'uuid', nullable: true })
  makeupSesId?: string | null;

  @Column({ name: 'mkp_substitute_teacher_id', type: 'uuid', nullable: true })
  substituteTeacherId?: string | null;

  @Column({
    name: 'mkp_substitution_approver_id',
    type: 'uuid',
    nullable: true,
  })
  substitutionApproverId?: string | null;

  @Column({ name: 'mkp_proposed_at', type: 'timestamptz' })
  proposedAt!: Date;

  @Column({ name: 'mkp_proposed_by', type: 'uuid', nullable: true })
  proposedBy?: string | null;

  @Column({
    name: 'mkp_status',
    type: 'varchar',
    length: 15,
    default: 'PROPOSED',
  })
  status!: MakeupStatus;

  @Column({ name: 'mkp_advisor_id', type: 'uuid', nullable: true })
  advisorId?: string | null;

  @Column({ name: 'mkp_remark', type: 'text', nullable: true })
  remark?: string | null;

  @Column({ name: 'mkp_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'mkp_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
