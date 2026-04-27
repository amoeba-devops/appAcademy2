import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type VcfProvider = 'GOOGLE_MEET' | 'BODASCHOOL';

@Entity('amb_acm_cls_video_config')
export class VideoConfigTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'vcf_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  clsId!: string;

  @Column({ name: 'vcf_provider', type: 'varchar', length: 15, default: 'GOOGLE_MEET' })
  provider!: VcfProvider;

  @Column({ name: 'vcf_persistent_link', type: 'varchar', length: 500, nullable: true })
  persistentLink?: string | null;

  @Column({ name: 'vcf_bodaschool_room_id', type: 'varchar', length: 100, nullable: true })
  bodaschoolRoomId?: string | null;

  @Column({ name: 'vcf_gmeet_event_id', type: 'varchar', length: 200, nullable: true })
  gmeetEventId?: string | null;

  @Column({ name: 'vcf_changed_at', type: 'timestamptz' })
  changedAt!: Date;

  @Column({ name: 'vcf_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'vcf_updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
