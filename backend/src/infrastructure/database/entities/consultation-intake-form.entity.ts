import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { ConsultationEntity } from './consultation.entity';

@Entity('tac_consultation_intake_form')
export class ConsultationIntakeFormEntity {
  @PrimaryGeneratedColumn({ name: 'cif_id', type: 'bigint', unsigned: true })
  cifId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'cif_parent_name', type: 'varchar', length: 100 })
  cifParentName: string;

  @Column({ name: 'cif_phone', type: 'varchar', length: 30 })
  cifPhone: string;

  @Column({ name: 'cif_email', type: 'varchar', length: 200, nullable: true })
  cifEmail: string | null;

  @Column({ name: 'cif_child_grade', type: 'varchar', length: 20, nullable: true })
  cifChildGrade: string | null;

  @Column({ name: 'cif_program_interest', type: 'varchar', length: 100, nullable: true })
  cifProgramInterest: string | null;

  @Column({ name: 'cif_preferred_date', type: 'date', nullable: true })
  cifPreferredDate: string | null;

  @Column({ name: 'cif_message', type: 'text', nullable: true })
  cifMessage: string | null;

  @Column({ name: 'cif_is_consent_pi', type: 'boolean', default: false })
  cifIsConsentPi: boolean;

  @Column({ name: 'cif_captcha_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  cifCaptchaScore: string | null;

  @Column({ name: 'cif_ip', type: 'varchar', length: 45, nullable: true })
  cifIp: string | null;

  @Column({ name: 'cif_user_agent', type: 'varchar', length: 500, nullable: true })
  cifUserAgent: string | null;

  @Column({ name: 'cif_status', type: 'varchar', length: 20, default: 'NEW' })
  cifStatus: string;

  @Column({ name: 'cif_promoted_cst_id', type: 'bigint', unsigned: true, nullable: true })
  cifPromotedCstId: number | null;

  @CreateDateColumn({ name: 'cif_created_at' })
  cifCreatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => ConsultationEntity)
  @JoinColumn({ name: 'cif_promoted_cst_id' })
  promotedConsultation: ConsultationEntity;
}
