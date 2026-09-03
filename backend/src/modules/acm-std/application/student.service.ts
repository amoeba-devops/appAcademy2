import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { StudentTeacherTypeormEntity } from '../infrastructure/typeorm/student-teacher.typeorm-entity';
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
    @InjectRepository(StudentTeacherTypeormEntity, ACM_DS)
    private readonly studentTeacherRepo: Repository<StudentTeacherTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly parentService: ParentService,
  ) {}

  /**
   * PLN-260718 요구4 — 상담(신규상담)에서 수강등록으로 이어져 생성된 학생의 경우,
   * 원본 상담(inq_std_id 로 연결) 정보를 역조회한다. 학생당 최신 상담 1건.
   */
  private async lookupSourceInquiries(
    entId: string,
    stdIds: string[],
  ): Promise<Map<string, { id: string; seqNo: number; currentStage: string }>> {
    const ids = Array.from(new Set(stdIds.filter(Boolean)));
    const map = new Map<
      string,
      { id: string; seqNo: number; currentStage: string }
    >();
    if (ids.length === 0) return map;
    const rows: Array<{
      id: string;
      std_id: string;
      seq_no: number;
      current_stage: string;
    }> = await this.ds.query(
      `SELECT inq_id AS id, inq_std_id AS std_id, inq_seq_no AS seq_no,
              inq_current_stage AS current_stage
         FROM amb_acm_csl_inquiry
        WHERE ent_id = $1 AND inq_std_id = ANY($2::uuid[]) AND deleted_at IS NULL
        ORDER BY inq_seq_no DESC`,
      [entId, ids],
    );
    for (const r of rows) {
      // 최신(seq_no DESC) 1건만 유지 — 이미 존재하면 스킵.
      if (!map.has(r.std_id)) {
        map.set(r.std_id, {
          id: r.id,
          seqNo: Number(r.seq_no),
          currentStage: r.current_stage,
        });
      }
    }
    return map;
  }

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
   * REQ-260903B — 담당강사 복수. 전원 테넌트 검증 후 입력 순서대로
   * [{tchId, name}] 반환 (첫번째 = 대표). 미존재 강사는 400.
   */
  private async resolveTeachers(
    entId: string,
    teacherIds: string[],
  ): Promise<Array<{ tchId: string; name: string }>> {
    const ids = Array.from(new Set(teacherIds.filter(Boolean)));
    if (ids.length === 0) return [];
    const rows = await this.teacherRepo.find({
      where: { id: In(ids), entId },
      select: { id: true, name: true },
    });
    if (rows.length !== ids.length) {
      throw new BadRequestException('TEACHER_NOT_FOUND');
    }
    const nameMap = new Map(rows.map((r) => [r.id, r.name]));
    return ids.map((id) => ({ tchId: id, name: nameMap.get(id)! }));
  }

  /** 레거시 미러 값 — std_teacher(이름 콤마조인, 100자 절단) / std_teacher_id(대표). */
  private teacherMirror(teachers: Array<{ tchId: string; name: string }>): {
    teacher: string | null;
    teacherId: string | null;
  } {
    if (teachers.length === 0) return { teacher: null, teacherId: null };
    return {
      teacher: teachers.map((t) => t.name).join(', ').slice(0, 100),
      teacherId: teachers[0].tchId,
    };
  }

  /** 링크 행 전체 교체 (sort_order = 입력 순서). */
  private async syncTeacherLinks(
    entId: string,
    stdId: string,
    teachers: Array<{ tchId: string; name: string }>,
  ): Promise<void> {
    await this.studentTeacherRepo.delete({ entId, stdId });
    if (teachers.length === 0) return;
    await this.studentTeacherRepo.save(
      teachers.map((t, i) =>
        this.studentTeacherRepo.create({
          entId,
          stdId,
          tchId: t.tchId,
          sortOrder: i,
        }),
      ),
    );
  }

  /** 학생별 담당강사 배치 조회 — Map<stdId, [{tchId, name}]> (sort_order 순). */
  private async teachersByStudents(
    entId: string,
    stdIds: string[],
  ): Promise<Map<string, Array<{ tchId: string; name: string }>>> {
    const map = new Map<string, Array<{ tchId: string; name: string }>>();
    const ids = Array.from(new Set(stdIds.filter(Boolean)));
    if (ids.length === 0) return map;
    const rows: Array<{ std_id: string; tch_id: string; name: string }> =
      await this.ds.query(
        `SELECT st.std_id, st.tch_id, t.tch_name AS name
           FROM amb_acm_std_student_teacher st
           JOIN amb_acm_tch_teacher t ON t.tch_id = st.tch_id
          WHERE st.ent_id = $1 AND st.std_id = ANY($2::uuid[])
          ORDER BY st.st_sort_order ASC, st.created_at ASC`,
        [entId, ids],
      );
    for (const r of rows) {
      const arr = map.get(r.std_id) ?? [];
      arr.push({ tchId: r.tch_id, name: r.name });
      map.set(r.std_id, arr);
    }
    return map;
  }

  /** dto 의 stdTeacherIds(신규) 또는 stdTeacherId(하위호환)를 배열로 정규화. */
  private normalizeTeacherIds(dto: {
    stdTeacherIds?: string[];
    stdTeacherId?: string | null;
  }): string[] | undefined {
    if (dto.stdTeacherIds !== undefined) return dto.stdTeacherIds;
    if (dto.stdTeacherId !== undefined) {
      return dto.stdTeacherId ? [dto.stdTeacherId] : [];
    }
    return undefined;
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
      qb.andWhere(
        '(s.name ILIKE :q OR s.englishName ILIKE :q OR s.school ILIKE :q)',
        {
          q: `%${q.q}%`,
        },
      );
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
    const summaries = items.map(this.toSummary);
    // 요구4 — 목록 배지용: 상담 연결 여부. + REQ-260903B 담당강사 배치 하이드레이션.
    const stdIds = summaries.map((s) => s.id);
    const [srcMap, teacherMap] = await Promise.all([
      this.lookupSourceInquiries(entId, stdIds),
      this.teachersByStudents(entId, stdIds),
    ]);
    const withSource = summaries.map((s) => ({
      ...s,
      teachers: teacherMap.get(s.id) ?? [],
      sourceInquiry: srcMap.get(s.id) ?? null,
    }));
    return { items: withSource, total, page, limit };
  }

  async findOne(entId: string, id: string) {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');
    const parents = await this.parentService.listForStudent(entId, id);
    const sourceInquiry =
      (await this.lookupSourceInquiries(entId, [id])).get(id) ?? null;
    const teachers = (await this.teachersByStudents(entId, [id])).get(id) ?? [];
    return { ...this.toDetail(entity), teachers, parents, sourceInquiry };
  }

  async create(entId: string, dto: CreateStudentDto) {
    const email = dto.stdEmail?.trim();
    if (!email) throw new BadRequestException('EMAIL_REQUIRED');
    await this.assertEmailUnique(entId, email, null);

    // REQ-260903B — 담당강사 복수. stdTeacherIds(또는 하위호환 stdTeacherId) 검증
    // 후 레거시 컬럼(std_teacher/std_teacher_id)에 대표·이름 미러링.
    const teacherIds = this.normalizeTeacherIds(dto);
    const teachers =
      teacherIds !== undefined
        ? await this.resolveTeachers(entId, teacherIds)
        : [];
    const mirror =
      teacherIds !== undefined
        ? this.teacherMirror(teachers)
        : { teacher: dto.stdTeacher ?? null, teacherId: null };

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
      teacher: mirror.teacher,
      teacherId: mirror.teacherId,
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
    if (teacherIds !== undefined) {
      await this.syncTeacherLinks(entId, saved.id, teachers);
    }
    if (dto.stdParents) {
      await this.parentService.syncForStudent(entId, saved.id, dto.stdParents);
    }
    const parents = await this.parentService.listForStudent(entId, saved.id);
    return { ...this.toDetail(saved), teachers, parents };
  }

  async update(entId: string, id: string, dto: UpdateStudentDto) {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');

    if (dto.stdName !== undefined) entity.name = dto.stdName;
    if (dto.stdEnglishName !== undefined)
      entity.englishName = dto.stdEnglishName;
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
    if (dto.stdMapLanguage !== undefined)
      entity.mapLanguage = dto.stdMapLanguage;
    if (dto.stdMapNote !== undefined) entity.mapNote = dto.stdMapNote;
    // REQ-260903B — 담당강사 복수. stdTeacherIds(또는 하위호환 stdTeacherId)
    // 제공 시 링크 전체 동기화 + 레거시 미러 갱신, 빈 배열이면 전부 해제.
    const teacherIds = this.normalizeTeacherIds(dto);
    let syncedTeachers: Array<{ tchId: string; name: string }> | undefined;
    if (teacherIds !== undefined) {
      syncedTeachers = await this.resolveTeachers(entId, teacherIds);
      const mirror = this.teacherMirror(syncedTeachers);
      entity.teacher = mirror.teacher;
      entity.teacherId = mirror.teacherId;
    } else if (dto.stdTeacher !== undefined) {
      entity.teacher = dto.stdTeacher;
    }
    if (dto.stdSubject !== undefined) entity.subject = dto.stdSubject;
    if (dto.stdCurriculum !== undefined) entity.curriculum = dto.stdCurriculum;
    if (dto.stdMaterials !== undefined) entity.materials = dto.stdMaterials;
    if (dto.stdMobility !== undefined) entity.mobility = dto.stdMobility;
    if (dto.stdGpa !== undefined) entity.gpa = dto.stdGpa;
    if (dto.stdSsatIseeNote !== undefined)
      entity.ssatIseeNote = dto.stdSsatIseeNote;
    if (dto.stdSpecialNote !== undefined)
      entity.specialNote = dto.stdSpecialNote;
    if (dto.stdGoalsNote !== undefined) entity.goalsNote = dto.stdGoalsNote;
    if (dto.stdSatisfactionNote !== undefined)
      entity.satisfactionNote = dto.stdSatisfactionNote;
    if (dto.stdLastCounselDate !== undefined)
      entity.lastCounselDate = dto.stdLastCounselDate;
    if (dto.stdStartDate !== undefined) entity.startDate = dto.stdStartDate;
    if (dto.stdStatus !== undefined) entity.status = dto.stdStatus;

    entity.updatedAt = new Date();
    const saved = await this.repo.save(entity);
    if (syncedTeachers !== undefined) {
      await this.syncTeacherLinks(entId, saved.id, syncedTeachers);
    }
    if (dto.stdParents !== undefined) {
      await this.parentService.syncForStudent(entId, saved.id, dto.stdParents);
    }
    const parents = await this.parentService.listForStudent(entId, saved.id);
    const teachers =
      syncedTeachers ??
      ((await this.teachersByStudents(entId, saved.id ? [saved.id] : [])).get(
        saved.id,
      ) ??
        []);
    return { ...this.toDetail(saved), teachers, parents };
  }

  async changeStatus(entId: string, id: string, dto: ChangeStudentStatusDto) {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) throw new NotFoundException('STUDENT_NOT_FOUND');
    entity.status = dto.stdStatus;
    entity.updatedAt = new Date();
    const saved = await this.repo.save(entity);
    return this.toDetail(saved);
  }

  async remove(entId: string, id: string) {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
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
