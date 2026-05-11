import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import type {
  CreateStudentDto,
  UpdateStudentDto,
  ChangeStudentStatusDto,
  ListStudentsQueryDto,
} from './dto/student.dto';
import { ParentService } from './parent.service';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly repo: Repository<StudentTypeormEntity>,
    private readonly parentService: ParentService,
  ) {}

  async list(entId: string, q: ListStudentsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.entId = :entId', { entId })
      .andWhere('s.deletedAt IS NULL');

    if (q.status && q.status !== 'ALL') {
      qb.andWhere('s.status = :status', { status: q.status });
    } else if (!q.status) {
      qb.andWhere('s.status = :status', { status: 'ACTIVE' });
    }

    if (q.q) {
      qb.andWhere('(s.name ILIKE :q OR s.englishName ILIKE :q OR s.school ILIKE :q)', {
        q: `%${q.q}%`,
      });
    }

    if (q.school) {
      qb.andWhere('s.school ILIKE :school', { school: `%${q.school}%` });
    }

    if (q.grade) {
      qb.andWhere('s.grade = :grade', { grade: q.grade });
    }

    if (q.teacher) {
      qb.andWhere('s.teacher ILIKE :teacher', { teacher: `%${q.teacher}%` });
    }

    if (q.sort === 'createdAt') {
      qb.orderBy('s.createdAt', 'DESC');
    } else {
      qb.orderBy('s.name', 'ASC');
    }

    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(this.toSummary), total, page, limit };
  }

  async findOne(entId: string, id: string) {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');
    const parents = await this.parentService.listForStudent(entId, id);
    return { ...this.toDetail(entity), parents };
  }

  async create(entId: string, dto: CreateStudentDto) {
    const entity = this.repo.create({
      entId,
      name: dto.stdName,
      englishName: dto.stdEnglishName,
      gender: dto.stdGender,
      birthDate: dto.stdBirthDate,
      phone: dto.stdPhone,
      email: dto.stdEmail,
      residence: dto.stdResidence,
      school: dto.stdSchool,
      grade: dto.stdGrade,
      mapReading: dto.stdMapReading,
      mapMath: dto.stdMapMath,
      mapLanguage: dto.stdMapLanguage,
      mapNote: dto.stdMapNote,
      teacher: dto.stdTeacher,
      subject: dto.stdSubject,
      curriculum: dto.stdCurriculum,
      materials: dto.stdMaterials,
      mobility: dto.stdMobility,
      gpa: dto.stdGpa,
      ssatIseeNote: dto.stdSsatIseeNote,
      specialNote: dto.stdSpecialNote,
      goalsNote: dto.stdGoalsNote,
      satisfactionNote: dto.stdSatisfactionNote,
      lastCounselDate: dto.stdLastCounselDate,
      startDate: dto.stdStartDate,
      status: dto.stdStatus ?? 'ACTIVE',
    });
    const saved = await this.repo.save(entity);
    if (dto.stdParents) {
      await this.parentService.syncForStudent(entId, saved.id, dto.stdParents);
    }
    const parents = await this.parentService.listForStudent(entId, saved.id);
    return { ...this.toDetail(saved), parents };
  }

  async update(entId: string, id: string, dto: UpdateStudentDto) {
    const entity = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');

    if (dto.stdName !== undefined) entity.name = dto.stdName;
    if (dto.stdEnglishName !== undefined) entity.englishName = dto.stdEnglishName;
    if (dto.stdGender !== undefined) entity.gender = dto.stdGender;
    if (dto.stdBirthDate !== undefined) entity.birthDate = dto.stdBirthDate;
    if (dto.stdPhone !== undefined) entity.phone = dto.stdPhone;
    if (dto.stdEmail !== undefined) entity.email = dto.stdEmail;
    if (dto.stdResidence !== undefined) entity.residence = dto.stdResidence;
    if (dto.stdSchool !== undefined) entity.school = dto.stdSchool;
    if (dto.stdGrade !== undefined) entity.grade = dto.stdGrade;
    if (dto.stdMapReading !== undefined) entity.mapReading = dto.stdMapReading;
    if (dto.stdMapMath !== undefined) entity.mapMath = dto.stdMapMath;
    if (dto.stdMapLanguage !== undefined) entity.mapLanguage = dto.stdMapLanguage;
    if (dto.stdMapNote !== undefined) entity.mapNote = dto.stdMapNote;
    if (dto.stdTeacher !== undefined) entity.teacher = dto.stdTeacher;
    if (dto.stdSubject !== undefined) entity.subject = dto.stdSubject;
    if (dto.stdCurriculum !== undefined) entity.curriculum = dto.stdCurriculum;
    if (dto.stdMaterials !== undefined) entity.materials = dto.stdMaterials;
    if (dto.stdMobility !== undefined) entity.mobility = dto.stdMobility;
    if (dto.stdGpa !== undefined) entity.gpa = dto.stdGpa;
    if (dto.stdSsatIseeNote !== undefined) entity.ssatIseeNote = dto.stdSsatIseeNote;
    if (dto.stdSpecialNote !== undefined) entity.specialNote = dto.stdSpecialNote;
    if (dto.stdGoalsNote !== undefined) entity.goalsNote = dto.stdGoalsNote;
    if (dto.stdSatisfactionNote !== undefined) entity.satisfactionNote = dto.stdSatisfactionNote;
    if (dto.stdLastCounselDate !== undefined) entity.lastCounselDate = dto.stdLastCounselDate;
    if (dto.stdStartDate !== undefined) entity.startDate = dto.stdStartDate;
    if (dto.stdStatus !== undefined) entity.status = dto.stdStatus;

    entity.updatedAt = new Date();
    const saved = await this.repo.save(entity);
    if (dto.stdParents !== undefined) {
      await this.parentService.syncForStudent(entId, saved.id, dto.stdParents);
    }
    const parents = await this.parentService.listForStudent(entId, saved.id);
    return { ...this.toDetail(saved), parents };
  }

  async changeStatus(entId: string, id: string, dto: ChangeStudentStatusDto) {
    const entity = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');
    entity.status = dto.stdStatus;
    entity.updatedAt = new Date();
    const saved = await this.repo.save(entity);
    return this.toDetail(saved);
  }

  async remove(entId: string, id: string) {
    const entity = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');
    entity.deletedAt = new Date();
    entity.updatedAt = new Date();
    await this.repo.save(entity);
    return { id };
  }

  private toSummary(e: StudentTypeormEntity) {
    return {
      id: e.id,
      name: e.name,
      englishName: e.englishName,
      gender: e.gender,
      school: e.school,
      grade: e.grade,
      teacher: e.teacher,
      status: e.status,
      startDate: e.startDate,
      createdAt: e.createdAt,
    };
  }

  private toDetail(e: StudentTypeormEntity) {
    return {
      id: e.id,
      entId: e.entId,
      name: e.name,
      englishName: e.englishName,
      gender: e.gender,
      birthDate: e.birthDate,
      phone: e.phone,
      email: e.email,
      residence: e.residence,
      school: e.school,
      grade: e.grade,
      mapReading: e.mapReading,
      mapMath: e.mapMath,
      mapLanguage: e.mapLanguage,
      mapNote: e.mapNote,
      teacher: e.teacher,
      subject: e.subject,
      curriculum: e.curriculum,
      materials: e.materials,
      scheduleJson: e.scheduleJson,
      mobility: e.mobility,
      gpa: e.gpa,
      ssatIseeNote: e.ssatIseeNote,
      specialNote: e.specialNote,
      goalsNote: e.goalsNote,
      satisfactionNote: e.satisfactionNote,
      lastCounselDate: e.lastCounselDate,
      startDate: e.startDate,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
