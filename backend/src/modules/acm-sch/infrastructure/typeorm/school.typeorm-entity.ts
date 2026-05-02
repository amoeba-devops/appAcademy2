import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('amb_acm_sch_school')
@Index('uq_acm_sch_school_ent_name', ['entId', 'name'], { unique: true, where: '"deleted_at" IS NULL' })
export class SchoolTypeormEntity {
  @PrimaryColumn({ name: 'sch_id', type: 'uuid' })
  id!: string;

  @Index('idx_acm_sch_school_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'level', type: 'varchar', length: 16 })
  level!: 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'FOREIGN';

  @Column({ name: 'region', type: 'varchar', length: 50, nullable: true })
  region?: string;

  @Column({ name: 'district', type: 'varchar', length: 50, nullable: true })
  district?: string;

  @Column({ name: 'is_foreign', type: 'boolean', default: false })
  isForeign!: boolean;

  @Column({ name: 'is_authorized', type: 'boolean', default: true })
  isAuthorized!: boolean;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
