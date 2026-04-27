import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Enrollment } from '../../../domain/entities/enrollment.js';
import type { IClassRepository } from '../../../domain/repositories/class-repository.interface.js';
import { CLASS_REPOSITORY } from '../../../domain/repositories/class-repository.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import type { IStudentRepository } from '../../../domain/repositories/student-repository.interface.js';
import { STUDENT_REPOSITORY } from '../../../domain/repositories/student-repository.interface.js';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface.js';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface.js';
import type { CreateEnrollmentDto } from '../../dto/enrollment/index.js';
import { EnrollmentResponseDto } from '../../dto/enrollment/index.js';
import { NOTIFICATION_EVENTS } from '../../notification/notification-context.types.js';

@Injectable()
export class CreateEnrollmentUseCase {
  private readonly logger = new Logger(CreateEnrollmentUseCase.name);

  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: IClassRepository,
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
    private readonly events: EventEmitter2,
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

      // C-NTF-01: best-effort, isolate notification failures from domain transaction
      try {
        const parentId = enrollment.appliedParentId ?? student.primaryParentId;
        const parent = parentId ? await this.parentRepo.findById(parentId) : null;
        const parentPhone = parent?.phone ?? null;
        if (parentPhone) {
          this.events.emit(NOTIFICATION_EVENTS.EnrollmentConfirmed, {
            academyId,
            recipients: [parentPhone],
            recipientKind: 'PARENT',
            subjectId: saved.id,
            subjectKind: 'ENROLLMENT',
            variables: {
              studentName: student.name ?? '',
              className: cls.programName ?? '',
              programName: cls.programName ?? '',
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to emit ENROLLMENT_CONFIRMED event: ${(err as Error).message}`,
        );
      }
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
