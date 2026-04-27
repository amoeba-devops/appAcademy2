import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { TEACHER_REPOSITORY } from '../../../domain/repositories/teacher-repository.interface';
import { CreateTeacherDto, TeacherResponseDto } from '../../dto/teacher';
import { Teacher } from '../../../domain/entities/teacher';
import { AMA_CLIENT_SERVICE } from '../../../infrastructure/external/ama/interfaces/ama-client.interface';
import type { IAmaClientService } from '../../../infrastructure/external/ama/interfaces/ama-client.interface';

@Injectable()
export class CreateTeacherUseCase {
  constructor(
    @Inject(TEACHER_REPOSITORY)
    private readonly teacherRepo: ITeacherRepository,
    @Inject(AMA_CLIENT_SERVICE)
    private readonly ama: IAmaClientService,
  ) {}

  async execute(
    academyId: number,
    dto: CreateTeacherDto,
  ): Promise<TeacherResponseDto> {
    // 1) Validate AMA Client exists (FR-AMA-03)
    const amaClient = await this.ama.getClient(dto.amaClientId);
    if (!amaClient) {
      throw new BadRequestException({
        error: {
          code: 'AMA_CLIENT_NOT_FOUND',
          message: `AMA Client '${dto.amaClientId}' not found`,
        },
      });
    }

    // 2) Check duplicate within tenant
    const existing = await this.teacherRepo.findByAmaClientId(
      academyId,
      dto.amaClientId,
    );
    if (existing) {
      throw new ConflictException(
        `Teacher with AMA Client ID '${dto.amaClientId}' already exists`,
      );
    }

    // 3) Persist with cached profile (FR-AMA-04)
    const teacher = await this.teacherRepo.create({
      academyId,
      amaClientId: dto.amaClientId,
      teachingSubjects: dto.teachingSubjects ?? null,
      employmentType: dto.employmentType,
      status: 'ACTIVE',
      cachedProfile: {
        name: amaClient.name,
        phone: amaClient.phone ?? undefined,
        email: amaClient.email ?? undefined,
        employmentType: amaClient.employmentType ?? undefined,
        profileImageUrl: amaClient.profileImageUrl ?? undefined,
        amaUpdatedAt: amaClient.updatedAt,
      },
      lastSyncedAt: new Date(),
    } as Partial<Teacher>);

    const res = new TeacherResponseDto();
    res.id = teacher.id;
    res.amaClientId = teacher.amaClientId;
    res.teachingSubjects = teacher.teachingSubjects;
    res.employmentType = teacher.employmentType;
    res.status = teacher.status;
    res.lastSyncedAt = teacher.lastSyncedAt;
    res.cachedName = teacher.cachedProfile?.name ?? null;
    res.cachedPhone = teacher.cachedProfile?.phone ?? null;
    res.createdAt = teacher.createdAt;
    res.updatedAt = teacher.updatedAt;
    return res;
  }
}
