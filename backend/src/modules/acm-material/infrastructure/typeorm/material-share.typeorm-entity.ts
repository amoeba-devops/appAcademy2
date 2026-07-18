import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * PLN-260718 P3 — per-post share target for a material (자료 공유 대상).
 *
 * A teacher shares to students (tgt_kind=STUDENT); a student shares to a
 * teacher (tgt_kind=TEACHER) as a submission (제출). One row per (material,
 * target). tgt_ref_id is std_id / tch_id depending on tgt_kind.
 */
export type MaterialShareTargetKind = 'STUDENT' | 'TEACHER';
/** PLN-260719 B — 공유대상 권한 (뷰어=열람+댓글, 편집자=+본문 수정). */
export type MaterialShareRole = 'VIEWER' | 'EDITOR';

@Entity('amb_acm_material_share')
@Index('idx_acm_material_share_mat', ['entId', 'matId'])
@Index('idx_acm_material_share_tgt', ['entId', 'tgtKind', 'tgtRefId'])
export class MaterialShareTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'msh_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mat_id', type: 'uuid' })
  matId!: string;

  @Column({ name: 'msh_tgt_kind', type: 'varchar', length: 20 })
  tgtKind!: MaterialShareTargetKind;

  @Column({ name: 'msh_tgt_ref_id', type: 'uuid' })
  tgtRefId!: string;

  @Column({ name: 'msh_role', type: 'varchar', length: 10, default: 'VIEWER' })
  role!: MaterialShareRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
