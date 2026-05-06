import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MapPassageTypeormEntity } from './map-passage.typeorm-entity';

export type MpqStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
export type MpqDifficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';

@Entity('amb_acm_map_question')
@Index('idx_acm_mpq_ent_grade', ['entId', 'grade', 'status'])
export class MapQuestionTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mpq_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mpg_id', type: 'uuid' })
  passageId!: string;

  @ManyToOne(() => MapPassageTypeormEntity, { eager: false })
  @JoinColumn({ name: 'mpg_id' })
  passage?: MapPassageTypeormEntity;

  @Column({ name: 'mpq_grade', type: 'varchar', length: 8 })
  grade!: string;

  @Column({ name: 'mpq_domain', type: 'varchar', length: 20, default: 'RC' })
  domain!: string;

  @Column({ name: 'mpq_external_no', type: 'int' })
  externalNo!: number;

  @Column({ name: 'mpq_question', type: 'text' })
  question!: string;

  @Column({ name: 'mpq_choices', type: 'jsonb' })
  choices!: string[];

  @Column({ name: 'mpq_answer_index', type: 'smallint', nullable: true })
  answerIndex?: number | null;

  @Column({ name: 'mpq_explanation', type: 'text', nullable: true })
  explanation?: string | null;

  @Column({ name: 'mpq_difficulty', type: 'varchar', length: 16, default: 'INTERMEDIATE' })
  difficulty!: MpqDifficulty;

  @Column({ name: 'mpq_source', type: 'varchar', length: 40, default: 'MAP_RC_G2-4_PAST' })
  source!: string;

  @Column({ name: 'mpq_version', type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'mpq_status', type: 'varchar', length: 16, default: 'PUBLISHED' })
  status!: MpqStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
