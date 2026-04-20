import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Enrollment } from '../../../domain/entities/enrollment.js';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface.js';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface.js';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface.js';
import type { CreateEnrollmentDto } from '../../dto/enrollment/index.js';
import { EnrollmentResponseDto } from '../../dto/enrollment/index.js';

@Injectable()
export class CreateEnrollmentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateEnrollmentDto,
  ): Promise<EnrollmentResponseDto> {
    const cls = await this.classRepo.findByIdWithRelations(dto.classId);
    if (!cls || cls.academyId !== academyId) {
      throw new BadRequestException('Class not found');
    }

    const student = await this.studentRepo.findById(dto.studentId);
    if (!student || student.academyId !== academyId) {
      throw new BadRequestException('Student not found');
    }

    const existing = await this.enrollmentRepo.findByClassAndStudent(
      dto.classId,
      dto.studentId,
    );
    if (existing) {
      throw new ConflictException('Student is already enrolled in this class');
    }

    const confirmedCount = await this.enrollmentRepo.countByClassId(dto.classId, [
      'CONFIRMED',
    ]);
    const status = confirmedCount < cls.capacity ? 'CONFIRMED' : 'WAITLIST';

    const now = new Date();
    const enrollment = new Enrollment();
    enrollment.academyId = academyId;
    enrollment.classId = dto.classId;
    enrollment.studentId = dto.studentId;
    enrollment.appliedParentId = dto.appliedParentId ?? student.primaryParentId;
    enrollment.status = status;
    enrollment.appliedAt = now;
    enrollment.confirmedAt = status === 'CONFIRMED' ? now : null;
    enrollment.canceledAt = null;

    const saved = await this.enrollmentRepo.create(enrollment);

    if (status === 'CONFIRMED') {
      await this.classRepo.update(cls.id, { enrolledCount: confirmedCount + 1 });
    }

    return this.toResponse(saved);
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
