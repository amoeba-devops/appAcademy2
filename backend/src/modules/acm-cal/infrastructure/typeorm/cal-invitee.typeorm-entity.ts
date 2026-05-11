import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type CalInviteeKind = 'STUDENT' | 'TEACHER' | 'PARENT';
export type CalInviteeNotifyStatus =
  | 'SENT'
  | 'SKIPPED_NO_EMAIL'
  | 'SKIPPED_NO_SMTP'
  | 'FAILED';

@Entity('amb_acm_cal_invitee')
@Unique('uq_acm_cal_invitee_evt_kind_ref', ['evtId', 'kind', 'refId'])
@Index('idx_acm_cal_inv_ent_evt', ['entId', 'evtId'])
@Index('idx_acm_cal_inv_ref', ['kind', 'refId'])
export class CalInviteeTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'inv_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_id', type: 'uuid' })
  evtId!: string;

  @Column({ name: 'inv_kind', type: 'varchar', length: 10 })
  kind!: CalInviteeKind;

  @Column({ name: 'inv_ref_id', type: 'uuid' })
  refId!: string;

  @Column({ name: 'inv_notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date | null;

  @Column({ name: 'inv_notify_status', type: 'varchar', length: 20, nullable: true })
  notifyStatus?: CalInviteeNotifyStatus | null;

  @Column({ name: 'inv_notify_error', type: 'varchar', length: 200, nullable: true })
  notifyError?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
