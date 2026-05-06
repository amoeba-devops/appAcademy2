import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type MpgOrdinal = 1 | 2;
export type MpgStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

@Entity('amb_acm_map_passage')
@Index('idx_acm_mpg_ent_grade', ['entId', 'grade', 'status'])
export class MapPassageTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'mpg_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'mpg_grade', type: 'varchar', length: 8 })
  grade!: string;

  @Column({ name: 'mpg_domain', type: 'varchar', length: 20, default: 'RC' })
  domain!: string;

  @Column({ name: 'mpg_body', type: 'text' })
  body!: string;

  @Column({ name: 'mpg_glossary', type: 'text', nullable: true })
  glossary?: string | null;

  @Column({ name: 'mpg_pair_group_id', type: 'uuid', nullable: true })
  pairGroupId?: string | null;

  @Column({ name: 'mpg_ordinal', type: 'smallint', default: 1 })
  ordinal!: MpgOrdinal;

  @Column({ name: 'mpg_source', type: 'varchar', length: 40, default: 'MAP_RC_G2-4_PAST' })
  source!: string;

  @Column({ name: 'mpg_version', type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'mpg_status', type: 'varchar', length: 16, default: 'PUBLISHED' })
  status!: MpgStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
