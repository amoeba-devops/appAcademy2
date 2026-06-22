import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ClassroomStatus = 'ACTIVE' | 'INACTIVE';

/** @see sql/acm/970-acm-posts-schema.sql §4 — 물리 교실 마스터 */
@Entity('amb_acm_classroom')
@Index('uq_acm_classroom_ent_name', ['entId', 'name'], { unique: true })
export class ClassroomTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'clr_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'clr_name', type: 'varchar', length: 50 })
  name!: string;

  @Column({ name: 'clr_capacity', type: 'integer', nullable: true })
  capacity?: number | null;

  @Column({ name: 'clr_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: ClassroomStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
