import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type CurriculumSystem = 'UK_YEAR' | 'US_GRADE' | 'KOREAN' | 'MIXED';

@Entity('amb_acm_ref_score_benchmark_grades')
@Index('idx_acm_ref_sbg_ent_range', ['entId', 'gradeMin', 'gradeMax'])
@Index('idx_acm_ref_sbg_sbm_ref', ['sbmId'])
export class ScoreBenchmarkGradeTypeormEntity {
  @PrimaryColumn({ name: 'sbg_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'sbm_id', type: 'uuid' })
  sbmId!: string;

  @Column({ name: 'sbg_grade_label', type: 'varchar', length: 10 })
  gradeLabel!: string;

  @Column({ name: 'sbg_grade_min', type: 'int' })
  gradeMin!: number;

  @Column({ name: 'sbg_grade_max', type: 'int' })
  gradeMax!: number;

  @Column({
    name: 'sbg_curriculum_system',
    type: 'varchar',
    length: 20,
    default: 'US_GRADE',
  })
  curriculumSystem!: CurriculumSystem;
}
