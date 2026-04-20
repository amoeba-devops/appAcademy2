import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Enrollment } from '../../../domain/entities/enrollment.js';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface.js';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import { EnrollmentResponseDto } from '../../dto/enrollment/index.js';

@Injectable()
export class UpdateEnrollmentStatusUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
  ) {}

  async execute(id: number, status: string): Promise<EnrollmentResponseDto> {
    const enrollment = await this.enrollmentRepo.findById(id);
    if (!enrollment) {
      throw new BadRequestException('Enrollment not found');
    }

    const cls = await this.classRepo.findById(enrollment.classId);
    if (!cls) {
      throw new BadRequestException('Class not found');
    }

    if (enrollment.status === status) {
      return this.toResponse(enrollment);
    }

    const confirmedCount = await this.enrollmentRepo.countByClassId(enrollment.classId, ['CONFIRMED']);
    const now = new Date();
    let updated: Enrollment;

    if (status === 'CONFIRMED') {
      if (enrollment.status !== 'CONFIRMED' && confirmedCount >= cls.capacity) {
        throw new ConflictException('Class is already full');
      }

      updated = await this.enrollmentRepo.update(id, {
        status,
        confirmedAt: now,
        canceledAt: null,
      });

      if (enrollment.status !== 'CONFIRMED') {
        await this.classRepo.update(cls.id, { enrolledCount: confirmedCount + 1 });
      }
    } else if (status === 'WAITLIST') {
      updated = await this.enrollmentRepo.update(id, {
        status,
        confirmedAt: null,
        canceledAt: null,
      });

      if (enrollment.status === 'CONFIRMED') {
        const nextCount = Math.max(confirmedCount - 1, 0);
        await this.classRepo.update(cls.id, { enrolledCount: nextCount });
        await this.promoteWaitlist(enrollment.classId, nextCount, cls.capacity);
      }
    } else {
      updated = await this.enrollmentRepo.update(id, {
        status: 'CANCELED',
        canceledAt: now,
      });

      if (enrollment.status === 'CONFIRMED') {
        const nextCount = Math.max(confirmedCount - 1, 0);
        await this.classRepo.update(cls.id, { enrolledCount: nextCount });
        await this.promoteWaitlist(enrollment.classId, nextCount, cls.capacity);
      }
    }

    return this.toResponse(updated);
  }

  private async promoteWaitlist(classId: number, confirmedCount: number, capacity: number): Promise<void> {
    if (confirmedCount >= capacity) {
      return;
    }

    const waitlist = await this.enrollmentRepo.findOldestWaitlistByClassId(classId);
    if (!waitlist) {
      return;
    }

    await this.enrollmentRepo.update(waitlist.id, {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      canceledAt: null,
    });
    await this.classRepo.update(classId, { enrolledCount: confirmedCount + 1 });
  }

  private toResponse(e: Enrollment): EnrollmentResponseDto {
    const dto = new EnrollmentResponseDto();
    dto.id = e.id;
    dto.classId = e.classId;
    dto.studentId = e.studentId;
    dto.appliedParentId = e.appliedParentId;
    dto.status = e.status;
    dto.appliedAt = e.appliedAt.toISOString();
    dto.confirmedAt = e.confirmedAt?.toISOString() ?? null;
    dto.canceledAt = e.canceledAt?.toISOString() ?? null;
    dto.studentName = e.studentName ?? null;
    dto.parentName = e.parentName ?? null;
    dto.className = e.className ?? null;
    dto.programName = e.programName ?? null;
    return dto;
  }
}