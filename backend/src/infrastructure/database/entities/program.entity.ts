import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { ProgramSettingEntity } from './program-setting.entity';
import { ClassEntity } from './class.entity';

@Entity('tac_programs')
export class ProgramEntity {
  @PrimaryGeneratedColumn({ name: 'prg_id', type: 'bigint', unsigned: true })
  prgId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'prg_name', type: 'varchar', length: 100 })
  prgName: string;

  @Column({ name: 'prg_category', type: 'varchar', length: 30 })
  prgCategory: string;

  @Column({ name: 'prg_description', type: 'text', nullable: true })
  prgDescription: string | null;

  @Column({ name: 'prg_duration_weeks', type: 'int', nullable: true })
  prgDurationWeeks: number | null;

  @Column({ name: 'prg_target_age_min', type: 'int', nullable: true })
  prgTargetAgeMin: number | null;

  @Column({ name: 'prg_target_age_max', type: 'int', nullable: true })
  prgTargetAgeMax: number | null;

  @Column({ name: 'prg_level', type: 'varchar', length: 20, nullable: true })
  prgLevel: string | null;

  @Column({ name: 'prg_status', type: 'varchar', length: 20, default: 'DRAFT' })
  prgStatus: string;

  @CreateDateColumn({ name: 'prg_created_at' })
  prgCreatedAt: Date;

  @UpdateDateColumn({ name: 'prg_updated_at' })
  prgUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity, (a) => a.programs)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @OneToOne(() => ProgramSettingEntity, (ps) => ps.program)
  setting: ProgramSettingEntity;

  @OneToMany(() => ClassEntity, (c) => c.program)
  classes: ClassEntity[];
}
