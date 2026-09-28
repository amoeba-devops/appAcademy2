import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export type VideoProvider = 'GOOGLE_MEET' | 'BODASCHOOL';
@Entity('amb_acm_cal_video_config')
@Index('uq_acm_cal_video_config_ent', ['entId'], { unique: true })
export class CalVideoConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'vdc_id' }) id!: string;
  @Column({ name: 'ent_id', type: 'uuid' }) entId!: string;
  @Column({
    name: 'vdc_provider',
    type: 'varchar',
    length: 20,
    default: 'BODASCHOOL',
  })
  provider!: VideoProvider;
  @Column({
    name: 'vdc_boda_launch_until',
    type: 'timestamptz',
    nullable: true,
  })
  bodaLaunchUntil!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
