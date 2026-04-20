import { Inject, Injectable } from '@nestjs/common';
import { Enrollment } from '../../../domain/entities/enrollment.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import { EnrollmentResponseDto } from '../../dto/enrollment/index.js';

@Injectable()
export class GetEnrollmentsUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { status?: string; classId?: number; studentId?: number },
  ): Promise<EnrollmentResponseDto[]> {
    const enrollments = await this.enrollmentRepo.findByAcademyIdWithFilters(
      academyId,
      filters,
    );
    return enrollments.map((e) => this.toResponse(e));
  }

  private toResponse(e: Enrollment): EnrollmentResponseDto {
    const dto = new EnrollmentResponseDto();
    dto.id = e.id;
    dto.classId = e.classId;
    dto.studentId = e.studentId;
    dto.appliedParentId = e.appliedParentId;
    dto.status = e.status;
    dto.appliedAt = e.appliedAt instanceof Date ? e.appliedAt.toISOString() : String(e.appliedAt);
    dto.confirmedAt = e.confirmedAt instanceof Date ? e.confirmedAt.toISOString() : e.confirmedAt;
    dto.canceledAt = e.canceledAt instanceof Date ? e.canceledAt.toISOString() : e.canceledAt;
    dto.studentName = e.studentName ?? null;
    dto.parentName = e.parentName ?? null;
    dto.className = e.className ?? null;
    dto.programName = e.programName ?? null;
    return dto;
  }
}
