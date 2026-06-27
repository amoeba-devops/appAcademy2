import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * REQ-260626 FR-CSL-132 / Q-CSL-109 — per-tenant course master.
 * Operator picks from this master or types a freetext value on
 * enrollment (enr_course_freetext). Codes are upper-case slugs like
 * 'MAP', 'ISEE', 'SSAT', etc.; uniqueness is per tenant.
 * @see sql/acm/985 §4
 */
@Entity('amb_acm_csl_course')
@Index('idx_acm_csl_course_ent_active', ['entId', 'isActive'])
@Index('uq_acm_csl_course_ent_code', ['entId', 'code'], { unique: true })
export class CourseTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'crs_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'crs_code', type: 'varchar', length: 40 })
  code!: string;

  @Column({ name: 'crs_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'crs_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
