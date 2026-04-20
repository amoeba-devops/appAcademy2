import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';

@Entity('tac_classrooms')
export class ClassroomEntity {
  @PrimaryGeneratedColumn({ name: 'clr_id', type: 'bigint', unsigned: true })
  clrId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'clr_name', type: 'varchar', length: 50 })
  clrName: string;

  @Column({ name: 'clr_capacity', type: 'int', nullable: true })
  clrCapacity: number | null;

  @Column({ name: 'clr_status', type: 'varchar', length: 20, default: 'ACTIVE' })
  clrStatus: string;

  @ManyToOne(() => AcademyEntity, (a) => a.classrooms)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;
}
