import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MapAssignmentEntity } from './map-assignment.entity';
import { StudentEntity } from './student.entity';
import { MapItemEntity } from './map-item.entity';

@Entity('tac_map_responses')
export class MapResponseEntity {
  @PrimaryGeneratedColumn({ name: 'rsp_id', type: 'bigint', unsigned: true })
  rspId: number;

  @Column({ name: 'asn_id', type: 'bigint', unsigned: true })
  asnId: number;

  @Column({ name: 'std_id', type: 'bigint', unsigned: true })
  stdId: number;

  @Column({ name: 'itm_id', type: 'bigint', unsigned: true })
  itmId: number;

  @Column({ name: 'rsp_answer', type: 'json' })
  rspAnswer: any;

  @Column({ name: 'rsp_is_correct', type: 'boolean' })
  rspIsCorrect: boolean;

  @Column({ name: 'rsp_points_earned', type: 'int', default: 0 })
  rspPointsEarned: number;

  @Column({ name: 'rsp_submitted_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  rspSubmittedAt: Date;

  @ManyToOne(() => MapAssignmentEntity, (a) => a.responses)
  @JoinColumn({ name: 'asn_id' })
  assignment: MapAssignmentEntity;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'std_id' })
  student: StudentEntity;

  @ManyToOne(() => MapItemEntity)
  @JoinColumn({ name: 'itm_id' })
  item: MapItemEntity;
}
