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
import { ClassEntity } from './class.entity';

@Entity('tac_teachers')
export class TeacherEntity {
  @PrimaryGeneratedColumn({ name: 'tch_id', type: 'bigint', unsigned: true })
  tchId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'tch_ama_client_id', type: 'varchar', length: 64 })
  tchAmaClientId: string;

  @Column({ name: 'tch_teaching_subjects', type: 'json', nullable: true })
  tchTeachingSubjects: any | null;

  @Column({ name: 'tch_employment_type', type: 'varchar', length: 20 })
  tchEmploymentType: string;

  @Column({ name: 'tch_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  tchStatus: string;

  @Column({ name: 'tch_last_synced_at', type: 'datetime', nullable: true })
  tchLastSyncedAt: Date | null;

  @Column({ name: 'tch_cached_profile', type: 'json', nullable: true })
  tchCachedProfile: any | null;

  @CreateDateColumn({ name: 'tch_created_at' })
  tchCreatedAt: Date;

  @UpdateDateColumn({ name: 'tch_updated_at' })
  tchUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity, (a) => a.teachers)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @OneToMany(() => ClassEntity, (c) => c.teacher)
  classes: ClassEntity[];
}
