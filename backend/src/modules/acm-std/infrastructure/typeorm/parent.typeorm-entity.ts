import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('amb_acm_std_parent')
@Index('idx_acm_std_par_ent', ['entId'], { where: 'deleted_at IS NULL' })
export class ParentTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'par_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'par_name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'par_relation', type: 'varchar', length: 20, nullable: true })
  relation?: string | null;

  @Column({ name: 'par_phone', type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'par_email', type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
