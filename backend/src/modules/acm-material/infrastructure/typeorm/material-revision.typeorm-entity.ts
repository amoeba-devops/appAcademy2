import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * PLN-260719 B+ — 문서 게시글 저장 단위 리비전 (append-only).
 * 생성=v1, 저장/복원마다 seq 증가. 스냅샷(제목/본문) + 수정자 기록.
 */
@Entity('amb_acm_material_revision')
@Index('uq_acm_material_rev_seq', ['entId', 'matId', 'seq'], { unique: true })
export class MaterialRevisionTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mrv_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mat_id', type: 'uuid' })
  matId!: string;

  @Column({ name: 'mrv_seq', type: 'int' })
  seq!: number;

  @Column({ name: 'mrv_title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'mrv_content', type: 'text', default: '' })
  content!: string;

  @Column({ name: 'mrv_editor_kind', type: 'varchar', length: 20 })
  editorKind!: string;

  @Column({ name: 'mrv_editor_ref_id', type: 'uuid', nullable: true })
  editorRefId?: string | null;

  @Column({
    name: 'mrv_editor_name',
    type: 'varchar',
    length: 100,
    default: '-',
  })
  editorName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
