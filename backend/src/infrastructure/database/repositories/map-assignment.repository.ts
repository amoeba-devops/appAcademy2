import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { EnrollmentEntity } from '../entities/enrollment.entity';
import { MapAssignmentEntity } from '../entities/map-assignment.entity';
import { MapResponseEntity } from '../entities/map-response.entity';
import { MapTestSetEntity } from '../entities/map-test-set.entity';
import { StudentEntity } from '../entities/student.entity';
import { MapAssignment } from '../../../domain/entities/map-assignment';
import { IMapAssignmentRepository } from '../../../domain/repositories/map-repository.interface';

@Injectable()
export class MapAssignmentRepository implements IMapAssignmentRepository {
  constructor(
    @InjectRepository(MapAssignmentEntity)
    private readonly repo: Repository<MapAssignmentEntity>,
    @InjectRepository(MapTestSetEntity)
    private readonly testSetRepo: Repository<MapTestSetEntity>,
    @InjectRepository(MapResponseEntity)
    private readonly responseRepo: Repository<MapResponseEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
  ) {}

  async findById(id: number): Promise<MapAssignment | null> {
    const entity = await this.repo.findOne({ where: { asnId: id }, relations: ['testSet', 'responses'] });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<MapAssignment[]> {
    const entities = await this.repo.find({ relations: ['testSet', 'responses'] });
    return Promise.all(entities.map((entity) => this.toDomain(entity)));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; targetType?: string; search?: string },
  ): Promise<MapAssignment[]> {
    const qb = this.repo
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.testSet', 'testSet')
      .leftJoinAndSelect('assignment.responses', 'responses')
      .where('testSet.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('assignment.asn_status = :status', { status: filters.status });
    }

    if (filters.targetType) {
      qb.andWhere('assignment.asn_target_type = :targetType', { targetType: filters.targetType });
    }

    if (filters.search) {
      qb.andWhere('testSet.tst_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('assignment.asn_created_at', 'DESC');

    const entities = await qb.getMany();
    return Promise.all(entities.map((entity) => this.toDomain(entity)));
  }

  async findByIdWithRelations(id: number): Promise<MapAssignment | null> {
    const entity = await this.repo.findOne({
      where: { asnId: id },
      relations: ['testSet', 'responses'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async create(data: Partial<MapAssignment>): Promise<MapAssignment> {
    const testSetId = Number(data.testSetId);
    const targetId = Number(data.targetId);
    await this.ensureTestSetExists(testSetId);
    await this.ensureTargetExists(data.targetType ?? 'STUDENT', targetId);

    const entity = this.repo.create({
      tstId: testSetId,
      asnTargetType: data.targetType ?? 'STUDENT',
      asnTargetId: targetId,
      asnDueAt: data.dueAt instanceof Date ? data.dueAt : new Date(String(data.dueAt)),
      asnStatus: data.status ?? 'ASSIGNED',
    });

    const saved = await this.repo.save(entity);
    return (await this.findByIdWithRelations(saved.asnId))!;
  }

  async update(id: number, data: Partial<MapAssignment>): Promise<MapAssignment> {
    const existing = await this.repo.findOne({ where: { asnId: id } });
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    const nextTestSetId = data.testSetId !== undefined ? Number(data.testSetId) : Number(existing.tstId);
    const nextTargetType = data.targetType ?? existing.asnTargetType;
    const nextTargetId = data.targetId !== undefined ? Number(data.targetId) : Number(existing.asnTargetId);

    await this.ensureTestSetExists(nextTestSetId);
    await this.ensureTargetExists(nextTargetType, nextTargetId);

    await this.repo.update(
      { asnId: id },
      {
        tstId: nextTestSetId,
        asnTargetType: nextTargetType,
        asnTargetId: nextTargetId,
        asnDueAt:
          data.dueAt !== undefined
            ? data.dueAt instanceof Date
              ? data.dueAt
              : new Date(String(data.dueAt))
            : undefined,
        asnStatus: data.status,
      },
    );

    return (await this.findByIdWithRelations(id))!;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ asnId: id });
  }

  private async ensureTestSetExists(testSetId: number): Promise<void> {
    const testSet = await this.testSetRepo.findOne({ where: { tstId: testSetId } });
    if (!testSet) {
      throw new BadRequestException('Selected test set does not exist');
    }
  }

  private async ensureTargetExists(targetType: string, targetId: number): Promise<void> {
    if (targetType === 'STUDENT') {
      const student = await this.studentRepo.findOne({ where: { stdId: targetId } });
      if (!student) {
        throw new BadRequestException('Selected student does not exist');
      }
      return;
    }

    if (targetType === 'CLASS') {
      const classEntity = await this.classRepo.findOne({ where: { clsId: targetId } });
      if (!classEntity) {
        throw new BadRequestException('Selected class does not exist');
      }
      return;
    }

    throw new BadRequestException('Unsupported assignment target type');
  }

  private async toDomain(entity: MapAssignmentEntity): Promise<MapAssignment> {
    const assignment = new MapAssignment();
    assignment.id = entity.asnId;
    assignment.testSetId = Number(entity.tstId);
    assignment.testSetName = entity.testSet?.tstName ?? null;
    assignment.targetType = entity.asnTargetType;
    assignment.targetId = Number(entity.asnTargetId);
    assignment.dueAt = entity.asnDueAt;
    assignment.createdAt = entity.asnCreatedAt;

    const progress = await this.resolveProgress(assignment.id, assignment.targetType, assignment.targetId);
    assignment.targetName = progress.targetName;
    assignment.totalTargets = progress.totalTargets;
    assignment.completedTargets = progress.completedTargets;
    assignment.completionRate = progress.totalTargets > 0
      ? Math.round((progress.completedTargets / progress.totalTargets) * 100)
      : 0;
    assignment.status = this.resolveStatus(entity.asnStatus, assignment.dueAt, assignment.totalTargets, assignment.completedTargets);
    return assignment;
  }

  private async resolveProgress(
    assignmentId: number,
    targetType: string,
    targetId: number,
  ): Promise<{ targetName: string | null; totalTargets: number; completedTargets: number }> {
    if (targetType === 'STUDENT') {
      const student = await this.studentRepo.findOne({ where: { stdId: targetId } });
      const completedTargets = await this.responseRepo
        .createQueryBuilder('response')
        .where('response.asn_id = :assignmentId', { assignmentId })
        .select('COUNT(DISTINCT response.std_id)', 'count')
        .getRawOne<{ count: string }>();

      return {
        targetName: student?.stdName ?? `Student #${targetId}`,
        totalTargets: 1,
        completedTargets: Number(completedTargets?.count ?? 0) > 0 ? 1 : 0,
      };
    }

    const classEntity = await this.classRepo.findOne({
      where: { clsId: targetId },
      relations: ['program'],
    });
    const enrolledCount = await this.enrollmentRepo.count({
      where: {
        clsId: targetId,
        enrStatus: 'CONFIRMED',
      },
    });
    const completedTargets = await this.responseRepo
      .createQueryBuilder('response')
      .where('response.asn_id = :assignmentId', { assignmentId })
      .select('COUNT(DISTINCT response.std_id)', 'count')
      .getRawOne<{ count: string }>();

    return {
      targetName: classEntity?.program?.prgName ?? `Class #${targetId}`,
      totalTargets: enrolledCount,
      completedTargets: Number(completedTargets?.count ?? 0),
    };
  }

  private resolveStatus(
    currentStatus: string,
    dueAt: Date,
    totalTargets: number,
    completedTargets: number,
  ): string {
    if (currentStatus === 'CANCELED') {
      return currentStatus;
    }

    if (totalTargets > 0 && completedTargets >= totalTargets) {
      return 'COMPLETED';
    }

    if (completedTargets > 0) {
      return 'IN_PROGRESS';
    }

    if (dueAt.getTime() < Date.now()) {
      return 'OVERDUE';
    }

    return currentStatus;
  }
}