import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ClassSessionEntity } from '../entities/class-session.entity';
import { IClassSessionRepository } from '../../../domain/repositories/class-repository.interface';
import { ClassSession } from '../../../domain/entities/class';

@Injectable()
export class ClassSessionRepository implements IClassSessionRepository {
  constructor(
    @InjectRepository(ClassSessionEntity)
    private readonly repo: Repository<ClassSessionEntity>,
  ) {}

  async findByClassId(classId: number): Promise<ClassSession[]> {
    const entities = await this.repo.find({
      where: { clsId: classId },
      order: { csnSessionNo: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findById(id: number): Promise<ClassSession | null> {
    const entity = await this.repo.findOne({ where: { csnId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByDateRange(
    academyId: number,
    startDate: Date,
    endDate: Date,
    filters?: { teacherId?: number; classroomId?: number },
  ): Promise<ClassSession[]> {
    const qb = this.repo
      .createQueryBuilder('csn')
      .innerJoinAndSelect('csn.class', 'cls')
      .leftJoinAndSelect('cls.program', 'prg')
      .leftJoinAndSelect('cls.teacher', 'tch')
      .leftJoinAndSelect('cls.classroom', 'clr')
      .where('cls.acdId = :academyId', { academyId })
      .andWhere('csn.csnStartAt >= :startDate', { startDate })
      .andWhere('csn.csnStartAt <= :endDate', { endDate });

    if (filters?.teacherId) {
      qb.andWhere('cls.tchId = :teacherId', { teacherId: filters.teacherId });
    }
    if (filters?.classroomId) {
      qb.andWhere('cls.clrId = :classroomId', { classroomId: filters.classroomId });
    }

    qb.orderBy('csn.csnStartAt', 'ASC');

    const entities = await qb.getMany();
    return entities.map((e) => {
      const s = this.toDomain(e);
      // Attach class info for timetable display
      if (e.class) {
        (s as any).programName = e.class.program?.prgName ?? null;
        (s as any).teacherName = e.class.teacher?.tchCachedProfile?.name ?? e.class.teacher?.tchAmaClientId ?? null;
        (s as any).classroomName = e.class.classroom?.clrName ?? null;
        (s as any).classId = e.clsId;
      }
      return s;
    });
  }

  async createMany(sessions: Partial<ClassSession>[]): Promise<ClassSession[]> {
    const entities = sessions.map((s) =>
      this.repo.create({
        clsId: s.classId!,
        csnSessionNo: s.sessionNo!,
        csnStartAt: s.startAt!,
        csnEndAt: s.endAt!,
        csnPlannedDurationHours: s.plannedDurationHours ?? null,
        csnStatus: s.status ?? 'SCHEDULED',
        csnSessionStatus: s.sessionStatus ?? 'SCHEDULED',
      }),
    );
    const saved = await this.repo.save(entities);
    return saved.map((e) => this.toDomain(e));
  }

  async update(id: number, data: Partial<ClassSession>): Promise<ClassSession> {
    const updateData: Partial<ClassSessionEntity> = {};

    if (data.sessionStatus !== undefined) updateData.csnSessionStatus = data.sessionStatus;
    if (data.actualDurationHours !== undefined) updateData.csnActualDurationHours = data.actualDurationHours;
    if (data.cancelReason !== undefined) updateData.csnCancelReason = data.cancelReason;
    if (data.memo !== undefined) updateData.csnMemo = data.memo;
    if (data.status !== undefined) updateData.csnStatus = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ csnId: id }, updateData);
    }

    const updated = await this.repo.findOneOrFail({ where: { csnId: id } });
    return this.toDomain(updated);
  }

  private toDomain(e: ClassSessionEntity): ClassSession {
    const s = new ClassSession();
    s.id = e.csnId;
    s.classId = e.clsId;
    s.sessionNo = e.csnSessionNo;
    s.startAt = e.csnStartAt;
    s.endAt = e.csnEndAt;
    s.plannedDurationHours = e.csnPlannedDurationHours;
    s.actualDurationHours = e.csnActualDurationHours;
    s.status = e.csnStatus;
    s.sessionStatus = e.csnSessionStatus;
    s.cancelReason = e.csnCancelReason;
    s.makeupSessionId = e.csnMakeupCsnId;
    s.memo = e.csnMemo;
    return s;
  }
}
