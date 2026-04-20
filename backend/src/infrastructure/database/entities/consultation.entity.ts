import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { ParentEntity } from './parent.entity';
import { ProgramEntity } from './program.entity';
import { VisitRecordEntity } from './visit-record.entity';

@Entity('tac_consultations')
export class ConsultationEntity {
  @PrimaryGeneratedColumn({ name: 'cst_id', type: 'bigint', unsigned: true })
  cstId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'prt_id', type: 'bigint', unsigned: true, nullable: true })
  prtId: number | null;

  @Column({ name: 'cst_interested_prg_id', type: 'bigint', unsigned: true, nullable: true })
  cstInterestedPrgId: number | null;

  @Column({ name: 'cst_channel', type: 'varchar', length: 20 })
  cstChannel: string;

  @Column({ name: 'cst_status', type: 'varchar', length: 20, default: 'OPEN' })
  cstStatus: string;

  @Column({ name: 'cst_assignee_user_id', type: 'bigint', unsigned: true, nullable: true })
  cstAssigneeUserId: number | null;

  @Column({ name: 'cst_note', type: 'text', nullable: true })
  cstNote: string | null;

  @Column({ name: 'cst_converted_enr_id', type: 'bigint', unsigned: true, nullable: true })
  cstConvertedEnrId: number | null;

  @CreateDateColumn({ name: 'cst_created_at' })
  cstCreatedAt: Date;

  @UpdateDateColumn({ name: 'cst_updated_at' })
  cstUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => ParentEntity)
  @JoinColumn({ name: 'prt_id' })
  parent: ParentEntity;

  @ManyToOne(() => ProgramEntity)
  @JoinColumn({ name: 'cst_interested_prg_id' })
  interestedProgram: ProgramEntity;

  @OneToMany(() => VisitRecordEntity, (v) => v.consultation)
  visitRecords: VisitRecordEntity[];
}
