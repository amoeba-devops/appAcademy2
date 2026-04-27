import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AttendanceTypeormEntity } from '../infrastructure/typeorm/attendance.typeorm-entity';
import { ClassStudentTypeormEntity } from '../infrastructure/typeorm/class-student.typeorm-entity';
import { SessionTypeormEntity } from '../infrastructure/typeorm/session.typeorm-entity';
import type { RecordAttendanceDto } from './dto/session.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    @InjectRepository(AttendanceTypeormEntity, ACM_DS)
    private readonly attRepo: Repository<AttendanceTypeormEntity>,
    @InjectRepository(SessionTypeormEntity, ACM_DS)
    private readonly sesRepo: Repository<SessionTypeormEntity>,
    @InjectRepository(ClassStudentTypeormEntity, ACM_DS)
    private readonly cstRepo: Repository<ClassStudentTypeormEntity>,
    private readonly events: EventEmitter2,
  ) {}

  async listForSession(entId: string, sesId: string) {
    return this.attRepo.find({ where: { entId, sesId } });
  }

  /**
   * Upsert attendance lines for a session. Validates each cst belongs to the
   * session's class. Auto-recalculates billable hours bound by ses_duration.
   */
  async record(
    entId: string,
    sesId: string,
    dto: RecordAttendanceDto,
    actorId?: string,
  ) {
    const ses = await this.sesRepo.findOne({ where: { id: sesId, entId, deletedAt: IsNull() } });
    if (!ses) throw new NotFoundException('Session not found');
    if (ses.status === 'CANCELLED') throw new BadRequestException('VAL_SES_STATUS_TRANSITION');

    const validCsts = await this.cstRepo.find({ where: { entId, clsId: ses.clsId } });
    const validIds = new Set(validCsts.map((c) => c.id));
    const maxHours = ses.durationMin / 60 + 0.5;
    const now = new Date();

    await this.ds.transaction(async (em) => {
      for (const line of dto.lines) {
        if (!validIds.has(line.cstId)) {
          throw new BadRequestException(`cstId ${line.cstId} not in class`);
        }
        if (line.billableHours < 0 || line.billableHours > maxHours) {
          throw new BadRequestException('VAL_HOURS_RANGE');
        }
        const existing = await em.getRepository(AttendanceTypeormEntity).findOne({
          where: { entId, sesId, cstId: line.cstId },
        });
        if (existing) {
          existing.status = line.status;
          existing.billableHours = line.billableHours.toFixed(1);
          existing.remark = line.remark ?? null;
          existing.recordedBy = actorId ?? null;
          existing.recordedAt = now;
          existing.updatedAt = now;
          await em.getRepository(AttendanceTypeormEntity).save(existing);
        } else {
          await em.getRepository(AttendanceTypeormEntity).insert({
            id: randomUUID(),
            entId,
            sesId,
            cstId: line.cstId,
            status: line.status,
            billableHours: line.billableHours.toFixed(1),
            recordedBy: actorId ?? null,
            recordedAt: now,
            remark: line.remark ?? null,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Auto-promote to HELD
      const sesEm = em.getRepository(SessionTypeormEntity);
      ses.heldAt = dto.heldAt ? new Date(dto.heldAt) : now;
      ses.actualMinutes = dto.actualMinutes ?? ses.durationMin;
      if (dto.mode) ses.mode = dto.mode;
      ses.status = 'HELD';
      ses.updatedAt = now;
      await sesEm.save(ses);
    });

    this.events.emit('acm.cls.attendance.recorded', {
      entId, occurredAt: now.toISOString(), actorId, sesId, clsId: ses.clsId,
    });
    return this.listForSession(entId, sesId);
  }
}
