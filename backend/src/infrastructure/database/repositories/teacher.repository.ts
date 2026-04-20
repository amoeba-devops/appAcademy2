import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherEntity } from '../entities/teacher.entity';
import { ITeacherRepository } from '../../../domain/repositories/teacher-repository.interface';
import { Teacher } from '../../../domain/entities/teacher';

@Injectable()
export class TeacherRepository implements ITeacherRepository {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly repo: Repository<TeacherEntity>,
  ) {}

  async findById(id: number): Promise<Teacher | null> {
    const entity = await this.repo.findOne({ where: { tchId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Teacher[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Teacher[]> {
    const entities = await this.repo.find({ where: { acdId: academyId } });
    return entities.map((e) => this.toDomain(e));
  }

  async findByAmaClientId(
    academyId: number,
    amaClientId: string,
  ): Promise<Teacher | null> {
    const entity = await this.repo.findOne({
      where: { acdId: academyId, tchAmaClientId: amaClientId },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; subject?: string; search?: string },
  ): Promise<Teacher[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('t.tch_status = :status', { status: filters.status });
    }

    if (filters.subject) {
      qb.andWhere('JSON_CONTAINS(t.tch_teaching_subjects, :subject)', {
        subject: JSON.stringify(filters.subject),
      });
    }

    if (filters.search) {
      qb.andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(t.tch_cached_profile, '$.name')) LIKE :search",
        { search: `%${filters.search}%` },
      );
    }

    qb.orderBy('t.tch_created_at', 'DESC');

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<Teacher>): Promise<Teacher> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      tchAmaClientId: data.amaClientId!,
      tchTeachingSubjects: data.teachingSubjects ?? null,
      tchEmploymentType: data.employmentType!,
      tchStatus: data.status ?? 'ACTIVE',
      tchCachedProfile: data.cachedProfile ?? null,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Teacher>): Promise<Teacher> {
    const updateData: Partial<TeacherEntity> = {};

    if (data.teachingSubjects !== undefined)
      updateData.tchTeachingSubjects = data.teachingSubjects;
    if (data.employmentType !== undefined)
      updateData.tchEmploymentType = data.employmentType;
    if (data.status !== undefined) updateData.tchStatus = data.status;
    if (data.cachedProfile !== undefined)
      updateData.tchCachedProfile = data.cachedProfile;
    if (data.lastSyncedAt !== undefined)
      updateData.tchLastSyncedAt = data.lastSyncedAt;

    await this.repo.update({ tchId: id }, updateData);
    const updated = await this.repo.findOneOrFail({ where: { tchId: id } });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ tchId: id });
  }

  private toDomain(e: TeacherEntity): Teacher {
    const t = new Teacher();
    t.id = e.tchId;
    t.academyId = e.acdId;
    t.amaClientId = e.tchAmaClientId;
    t.teachingSubjects = e.tchTeachingSubjects;
    t.employmentType = e.tchEmploymentType;
    t.status = e.tchStatus;
    t.lastSyncedAt = e.tchLastSyncedAt;
    t.cachedProfile = e.tchCachedProfile;
    t.createdAt = e.tchCreatedAt;
    t.updatedAt = e.tchUpdatedAt;
    return t;
  }
}
