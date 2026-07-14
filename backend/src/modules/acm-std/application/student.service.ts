import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
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
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly teacherRepo: Repository<TeacherTypeormEntity>,
    private readonly parentService: ParentService,
  ) {}

  /**
   * PLN-260714 — 학생 이메일은 필수(포털계정 로그인ID) + 테넌트 내 중복 불가.
   * 소프트삭제된 학생은 제외, 대소문자 무시 비교.
   */
  private async assertEmailUnique(
    entId: string,
    email: string,
    excludeId: string | null,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.entId = :entId', { entId })
      .andWhere('s.deletedAt IS NULL')
      .andWhere('LOWER(s.email) = LOWER(:email)', { email });
    if (excludeId) qb.andWhere('s.id != :excludeId', { excludeId });
    if (await qb.getExists()) throw new ConflictException('EMAIL_DUPLICATE');
  }

  /**
   * PLN-260714 — 담당강사 FK(std_teacher_id) 로 등록강사를 검증하고, 표시/검색
   * 호환을 위해 강사명을 free-text std_teacher 에 미러링할 값을 반환한다.
   */
  private async resolveTeacherName(entId: string, teacherId: string): Promise<string> {
    const teacher = await this.teacherRepo.findOne({
      where: { id: teacherId, entId },
      select: { id: true, name: true },
    });
    if (!teacher) throw new BadRequestException('TEACHER_NOT_FOUND');
    return teacher.name;
  }

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

    // dir 미지정 시 기존 기본값 유지 (name ASC / createdAt DESC)
    if (q.sort === 'createdAt') {
      qb.orderBy('s.createdAt', q.dir === 'asc' ? 'ASC' : 'DESC');
    } else {
      qb.orderBy('s.name', q.dir === 'desc' ? 'DESC' : 'ASC');
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
    const email = dto.stdEmail?.trim();
    if (!email) throw new BadRequestException('EMAIL_REQUIRED');
    await this.assertEmailUnique(entId, email, null);

    // 담당강사: FK 우선 — 선택 시 강사명을 free-text 에 미러링(표시/검색 호환).
    const teacher = dto.stdTeacherId
      ? await this.resolveTeacherName(entId, dto.stdTeacherId)
      : dto.stdTeacher;

    const entity = this.repo.create({
      entId,
      name: dto.stdName,
      englishName: dto.stdEnglishName,
      gender: dto.stdGender,
      birthDate: dto.stdBirthDate,
      phone: dto.stdPhone,
      email,
      residence: dto.stdResidence,
      school: dto.stdSchool,
      grade: dto.stdGrade,
      mapReading: dto.stdMapReading,
      mapMath: dto.stdMapMath,
      mapLanguage: dto.stdMapLanguage,
      mapNote: dto.stdMapNote,
      teacher,
      teacherId: dto.stdTeacherId ?? null,
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
    // PLN-260714 — 수정 후에도 이메일은 반드시 존재해야 하고, 중복이면 저장 불가.
    if (dto.stdEmail !== undefined) {
      const email = dto.stdEmail?.trim();
      if (!email) throw new BadRequestException('EMAIL_REQUIRED');
      await this.assertEmailUnique(entId, email, id);
      entity.email = email;
    } else if (!entity.email?.trim()) {
      throw new BadRequestException('EMAIL_REQUIRED');
    }
    if (dto.stdResidence !== undefined) entity.residence = dto.stdResidence;
    if (dto.stdSchool !== undefined) entity.school = dto.stdSchool;
    if (dto.stdGrade !== undefined) entity.grade = dto.stdGrade;
    if (dto.stdMapReading !== undefined) entity.mapReading = dto.stdMapReading;
    if (dto.stdMapMath !== undefined) entity.mapMath = dto.stdMapMath;
    if (dto.stdMapLanguage !== undefined) entity.mapLanguage = dto.stdMapLanguage;
    if (dto.stdMapNote !== undefined) entity.mapNote = dto.stdMapNote;
    // 담당강사: FK 우선. 지정되면 강사명을 free-text 에 미러링, 해제(빈 값)면 둘 다 초기화.
    if (dto.stdTeacherId !== undefined) {
      entity.teacherId = dto.stdTeacherId ?? null;
      entity.teacher = dto.stdTeacherId
        ? await this.resolveTeacherName(entId, dto.stdTeacherId)
        : null;
    } else if (dto.stdTeacher !== undefined) {
      entity.teacher = dto.stdTeacher;
    }
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
      teacherId: e.teacherId,
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
      teacherId: e.teacherId,
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
