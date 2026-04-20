import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { IClassRepository } from '../../../domain/repositories/class-repository.interface';
import { Class } from '../../../domain/entities/class';

@Injectable()
export class ClassRepository implements IClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
  ) {}

  async findById(id: number): Promise<Class | null> {
    const entity = await this.repo.findOne({ where: { clsId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Class[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Class[]> {
    const entities = await this.repo.find({
      where: { acdId: academyId },
      relations: ['program', 'teacher', 'classroom'],
      order: { clsCreatedAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByIdWithRelations(id: number): Promise<Class | null> {
    const entity = await this.repo.findOne({
      where: { clsId: id },
      relations: ['program', 'teacher', 'classroom'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; programId?: number; teacherId?: number; search?: string },
  ): Promise<Class[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.program', 'p')
      .leftJoinAndSelect('c.teacher', 't')
      .leftJoinAndSelect('c.classroom', 'cr')
      .where('c.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('c.cls_status = :status', { status: filters.status });
    }

    if (filters.programId) {
      qb.andWhere('c.prg_id = :programId', { programId: filters.programId });
    }

    if (filters.teacherId) {
      qb.andWhere('c.tch_id = :teacherId', { teacherId: filters.teacherId });
    }

    if (filters.search) {
      qb.andWhere('p.prg_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('c.cls_created_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<Class>): Promise<Class> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      prgId: data.programId!,
      tchId: data.teacherId!,
      clrId: data.classroomId ?? null,
      clsStartDate: data.startDate!,
      clsEndDate: data.endDate ?? null,
      clsCapacity: data.capacity!,
      clsEnrolledCount: data.enrolledCount ?? 0,
      clsStatus: data.status ?? 'DRAFT',
      clsSchedulePattern: data.schedulePattern ?? [],
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Class>): Promise<Class> {
    const updateData: Partial<ClassEntity> = {};

    if (data.teacherId !== undefined) updateData.tchId = data.teacherId;
    if (data.classroomId !== undefined) updateData.clrId = data.classroomId;
    if (data.endDate !== undefined) updateData.clsEndDate = data.endDate;
    if (data.capacity !== undefined) updateData.clsCapacity = data.capacity;
    if (data.status !== undefined) updateData.clsStatus = data.status;
    if (data.enrolledCount !== undefined) updateData.clsEnrolledCount = data.enrolledCount;
    if (data.schedulePattern !== undefined) updateData.clsSchedulePattern = data.schedulePattern;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ clsId: id }, updateData);
    }

    const updated = await this.repo.findOneOrFail({ where: { clsId: id } });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ clsId: id });
  }

  private toDomain(e: ClassEntity): Class {
    const c = new Class();
    c.id = e.clsId;
    c.academyId = e.acdId;
    c.programId = e.prgId;
    c.teacherId = e.tchId;
    c.classroomId = e.clrId;
    c.startDate = e.clsStartDate;
    c.endDate = e.clsEndDate;
    c.capacity = e.clsCapacity;
    c.enrolledCount = e.clsEnrolledCount;
    c.status = e.clsStatus;
    c.schedulePattern = e.clsSchedulePattern ?? [];
    c.createdAt = e.clsCreatedAt;
    c.updatedAt = e.clsUpdatedAt;

    // Populate joined fields
    if (e.program) {
      c.programName = e.program.prgName;
    }
    if (e.teacher) {
      c.teacherName = e.teacher.tchCachedProfile?.name ?? e.teacher.tchAmaClientId;
    }
    if (e.classroom) {
      c.classroomName = e.classroom.clrName;
    }

    return c;
  }
}
