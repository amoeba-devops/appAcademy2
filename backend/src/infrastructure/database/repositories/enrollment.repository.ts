import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnrollmentEntity } from '../entities/enrollment.entity';
import { Enrollment } from '../../../domain/entities/enrollment.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';

@Injectable()
export class EnrollmentRepository implements IEnrollmentRepository {
  constructor(
    @InjectRepository(EnrollmentEntity)
    private readonly repo: Repository<EnrollmentEntity>,
  ) {}

  async findById(id: number): Promise<Enrollment | null> {
    const entity = await this.repo.findOne({
      where: { enrId: id },
      relations: ['student', 'appliedParent', 'class', 'class.program'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Enrollment[]> {
    const entities = await this.repo.find({
      relations: ['student', 'appliedParent', 'class', 'class.program'],
      order: { enrAppliedAt: 'DESC' },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; classId?: number; studentId?: number },
  ): Promise<Enrollment[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.student', 's')
      .leftJoinAndSelect('e.appliedParent', 'p')
      .leftJoinAndSelect('e.class', 'c')
      .leftJoinAndSelect('c.program', 'prg')
      .where('e.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('e.enr_status = :status', { status: filters.status });
    }

    if (filters.classId) {
      qb.andWhere('e.cls_id = :classId', { classId: filters.classId });
    }

    if (filters.studentId) {
      qb.andWhere('e.std_id = :studentId', { studentId: filters.studentId });
    }

    qb.orderBy('e.enr_applied_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByClassAndStudent(classId: number, studentId: number): Promise<Enrollment | null> {
    const entity = await this.repo.findOne({
      where: { clsId: classId, stdId: studentId },
      relations: ['student', 'appliedParent', 'class', 'class.program'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findOldestWaitlistByClassId(classId: number): Promise<Enrollment | null> {
    const entity = await this.repo.findOne({
      where: { clsId: classId, enrStatus: 'WAITLIST' },
      relations: ['student', 'appliedParent', 'class', 'class.program'],
      order: { enrAppliedAt: 'ASC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async countByClassId(classId: number, statuses: string[]): Promise<number> {
    return this.repo.count({
      where: {
        clsId: classId,
        enrStatus: In(statuses),
      },
    });
  }

  async create(entity: Partial<Enrollment>): Promise<Enrollment> {
    const created = this.repo.create({
      acdId: entity.academyId!,
      clsId: entity.classId!,
      stdId: entity.studentId!,
      enrAppliedPrtId: entity.appliedParentId!,
      enrStatus: entity.status ?? 'PENDING',
      enrAppliedAt: entity.appliedAt ?? new Date(),
      enrConfirmedAt: entity.confirmedAt ?? null,
      enrCanceledAt: entity.canceledAt ?? null,
    });
    const saved = await this.repo.save(created);
    const reloaded = await this.findById(saved.enrId);
    if (!reloaded) {
      throw new Error('Enrollment creation failed');
    }
    return reloaded;
  }

  async update(id: number, entity: Partial<Enrollment>): Promise<Enrollment> {
    const updateData: Partial<EnrollmentEntity> = {};

    if (entity.appliedParentId !== undefined) updateData.enrAppliedPrtId = entity.appliedParentId;
    if (entity.status !== undefined) updateData.enrStatus = entity.status;
    if (entity.confirmedAt !== undefined) updateData.enrConfirmedAt = entity.confirmedAt;
    if (entity.canceledAt !== undefined) updateData.enrCanceledAt = entity.canceledAt;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ enrId: id }, updateData);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Enrollment not found after update');
    }
    return updated;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ enrId: id });
  }

  private toDomain(entity: EnrollmentEntity): Enrollment {
    const enrollment = new Enrollment();
    enrollment.id = entity.enrId;
    enrollment.academyId = entity.acdId;
    enrollment.classId = entity.clsId;
    enrollment.studentId = entity.stdId;
    enrollment.appliedParentId = entity.enrAppliedPrtId;
    enrollment.status = entity.enrStatus;
    enrollment.appliedAt = entity.enrAppliedAt;
    enrollment.confirmedAt = entity.enrConfirmedAt;
    enrollment.canceledAt = entity.enrCanceledAt;
    enrollment.studentName = entity.student?.stdName ?? null;
    enrollment.parentName = entity.appliedParent?.prtName ?? null;
    enrollment.programName = entity.class?.program?.prgName ?? null;
    enrollment.className = entity.class?.program?.prgName ?? null;
    return enrollment;
  }
}