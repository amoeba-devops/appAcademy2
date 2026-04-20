import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentEntity } from '../entities/student.entity';
import { IStudentRepository } from '../../../domain/repositories/student-repository.interface';
import { Student } from '../../../domain/entities/student';

@Injectable()
export class StudentRepository implements IStudentRepository {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly repo: Repository<StudentEntity>,
  ) {}

  async findById(id: number): Promise<Student | null> {
    const entity = await this.repo.findOne({ where: { stdId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Student[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Student[]> {
    const entities = await this.repo.find({ where: { acdId: academyId } });
    return entities.map((e) => this.toDomain(e));
  }

  async findByPrimaryParentId(parentId: number): Promise<Student[]> {
    const entities = await this.repo.find({ where: { prtId: parentId } });
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; lifecycleStatus?: string; grade?: string; search?: string },
  ): Promise<Student[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('s.std_status = :status', { status: filters.status });
    }
    if (filters.lifecycleStatus) {
      qb.andWhere('s.std_lifecycle_status = :lcStatus', { lcStatus: filters.lifecycleStatus });
    }
    if (filters.grade) {
      qb.andWhere('s.std_grade = :grade', { grade: filters.grade });
    }
    if (filters.search) {
      qb.andWhere('s.std_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('s.std_created_at', 'DESC');
    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<Student>): Promise<Student> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      prtId: data.primaryParentId!,
      stdName: data.name!,
      stdBirthDate: data.birthDate ?? null,
      stdGender: data.gender ?? null,
      stdSchool: data.school ?? null,
      stdGrade: data.grade ?? null,
      stdStatus: data.status ?? 'ACTIVE',
      stdLifecycleStatus: data.lifecycleStatus ?? 'CONSULTING',
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Student>): Promise<Student> {
    const updateData: Partial<StudentEntity> = {};
    if (data.name !== undefined) updateData.stdName = data.name;
    if (data.birthDate !== undefined) updateData.stdBirthDate = data.birthDate;
    if (data.gender !== undefined) updateData.stdGender = data.gender;
    if (data.school !== undefined) updateData.stdSchool = data.school;
    if (data.grade !== undefined) updateData.stdGrade = data.grade;
    if (data.status !== undefined) updateData.stdStatus = data.status;
    if (data.lifecycleStatus !== undefined) updateData.stdLifecycleStatus = data.lifecycleStatus;

    await this.repo.update({ stdId: id }, updateData);
    const updated = await this.repo.findOneOrFail({ where: { stdId: id } });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ stdId: id });
  }

  private toDomain(e: StudentEntity): Student {
    const s = new Student();
    s.id = e.stdId;
    s.academyId = e.acdId;
    s.primaryParentId = e.prtId;
    s.name = e.stdName;
    s.birthDate = e.stdBirthDate;
    s.gender = e.stdGender;
    s.school = e.stdSchool;
    s.grade = e.stdGrade;
    s.status = e.stdStatus;
    s.lifecycleStatus = e.stdLifecycleStatus;
    s.terminatedAt = e.stdTerminatedAt;
    s.terminationReason = e.stdTerminationReason;
    s.createdAt = e.stdCreatedAt;
    s.updatedAt = e.stdUpdatedAt;
    return s;
  }
}
