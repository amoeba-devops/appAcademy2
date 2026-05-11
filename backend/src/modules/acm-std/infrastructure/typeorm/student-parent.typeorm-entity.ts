import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('amb_acm_std_student_parent')
@Unique('uq_acm_std_sp_pair', ['stdId', 'parId'])
@Index('idx_acm_std_sp_par', ['parId'])
export class StudentParentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'sp_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'std_id', type: 'uuid' })
  stdId!: string;

  @Column({ name: 'par_id', type: 'uuid' })
  parId!: string;

  @Column({ name: 'sp_is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
