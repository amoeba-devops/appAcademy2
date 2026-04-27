import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ComplaintChannel = 'PHONE' | 'EMAIL' | 'CHAT' | 'IN_PERSON' | 'OTHER';
export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

@Entity('amb_acm_dsh_complaints')
export class ComplaintTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cmp_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cmp_date', type: 'date' })
  date!: string;

  @Column({ name: 'cmp_channel', type: 'varchar', length: 20 })
  channel!: ComplaintChannel;

  @Column({ name: 'cmp_severity', type: 'varchar', length: 10, default: 'MEDIUM' })
  severity!: ComplaintSeverity;

  @Column({ name: 'cmp_subject', type: 'varchar', length: 200, nullable: true })
  subject?: string | null;

  @Column({ name: 'cmp_description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'cmp_linked_qna_id', type: 'uuid', nullable: true })
  linkedQnaId?: string | null;

  @Column({ name: 'cmp_created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'cmp_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'cmp_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'cmp_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
