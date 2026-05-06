import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StfStatus = 'ACTIVE' | 'INACTIVE';

@Entity('amb_acm_stf_staff')
@Index('idx_acm_stf_ent_status', ['entId', 'status'], { where: 'deleted_at IS NULL' })
export class StaffTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'stf_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'stf_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'stf_english_name', type: 'varchar', length: 100, nullable: true })
  englishName?: string | null;

  @Column({ name: 'stf_email', type: 'varchar', length: 200 })
  email!: string;

  @Column({ name: 'stf_phone', type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'stf_position', type: 'varchar', length: 100, nullable: true })
  position?: string | null;

  @Column({ name: 'stf_department', type: 'varchar', length: 100, nullable: true })
  department?: string | null;

  @Column({ name: 'stf_hired_at', type: 'date', nullable: true })
  hiredAt?: string | null;

  @Column({ name: 'stf_memo', type: 'text', nullable: true })
  memo?: string | null;

  @Column({ name: 'stf_user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'stf_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: StfStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
