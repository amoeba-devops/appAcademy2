import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { EnrollmentEntity } from '../entities/enrollment.entity';
import { MapAssignmentEntity } from '../entities/map-assignment.entity';
import { MapItemEntity } from '../entities/map-item.entity';
import { MapPassageEntity } from '../entities/map-passage.entity';
import { ParentEntity } from '../entities/parent.entity';
import { MapResponseEntity } from '../entities/map-response.entity';
import { MapScoreEntity } from '../entities/map-score.entity';
import { MapTestSetEntity } from '../entities/map-test-set.entity';
import { StudentEntity } from '../entities/student.entity';
import { StudentGuardianEntity } from '../entities/student-guardian.entity';
import {
  MapGradingAssignment,
  MapGradingDetail,
  MapGradingItemInsight,
  MapHubGradeBreakdown,
  MapHubStats,
  MapPortalScoreHistory,
  MapPortalScoreSummary,
  MapPortalStudentOption,
  MapGradingStudentResult,
  MapScore,
} from '../../../domain/entities/map-score';
import { IMapScoreRepository } from '../../../domain/repositories/map-repository.interface';

@Injectable()
export class MapScoreRepository implements IMapScoreRepository {
  constructor(
    @InjectRepository(MapScoreEntity)
    private readonly repo: Repository<MapScoreEntity>,
    @InjectRepository(MapAssignmentEntity)
    private readonly assignmentRepo: Repository<MapAssignmentEntity>,
    @InjectRepository(MapResponseEntity)
    private readonly responseRepo: Repository<MapResponseEntity>,
    @InjectRepository(MapTestSetEntity)
    private readonly testSetRepo: Repository<MapTestSetEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentRepo: Repository<ParentEntity>,
    @InjectRepository(StudentGuardianEntity)
    private readonly studentGuardianRepo: Repository<StudentGuardianEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(MapPassageEntity)
    private readonly passageRepo: Repository<MapPassageEntity>,
    @InjectRepository(MapItemEntity)
    private readonly itemRepo: Repository<MapItemEntity>,
  ) {}

  async findById(id: number): Promise<MapScore | null> {
    const entity = await this.repo.findOne({ where: { mscId: id }, relations: ['student', 'assignment'] });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<MapScore[]> {
    const entities = await this.repo.find({ relations: ['student', 'assignment'] });
    return entities.map((entity) => this.toDomain(entity));
  }

  async create(entity: Partial<MapScore>): Promise<MapScore> {
    const saved = await this.repo.save(
      this.repo.create({
        stdId: Number(entity.studentId),
        asnId: entity.assignmentId !== null && entity.assignmentId !== undefined ? Number(entity.assignmentId) : null,
        mscAssessedAt: entity.assessedAt!,
        mscReadingScore: entity.readingScore ?? null,
        mscMathScore: entity.mathScore ?? null,
        mscLanguageScore: entity.languageScore ?? null,
        mscSource: entity.source ?? 'SYSTEM',
        mscNote: entity.note ?? null,
      }),
    );
    return (await this.findById(Number(saved.mscId)))!;
  }

  async update(id: number, entity: Partial<MapScore>): Promise<MapScore> {
    await this.repo.update(
      { mscId: id },
      {
        stdId: entity.studentId !== undefined ? Number(entity.studentId) : undefined,
        asnId:
          entity.assignmentId !== undefined
            ? entity.assignmentId === null
              ? null
              : Number(entity.assignmentId)
            : undefined,
        mscAssessedAt: entity.assessedAt,
        mscReadingScore: entity.readingScore,
        mscMathScore: entity.mathScore,
        mscLanguageScore: entity.languageScore,
        mscSource: entity.source,
        mscNote: entity.note,
      },
    );
    return (await this.findById(id))!;
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ mscId: id });
  }

  async findByStudentId(studentId: number): Promise<MapScore[]> {
    const entities = await this.repo.find({ where: { stdId: studentId }, relations: ['student', 'assignment'] });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByAssignmentId(assignmentId: number): Promise<MapScore[]> {
    const entities = await this.repo.find({ where: { asnId: assignmentId }, relations: ['student', 'assignment'] });
    return entities.map((entity) => this.toDomain(entity));
  }

  async getGradingQueue(
    academyId: number,
    filters: { status?: string; search?: string },
  ): Promise<MapGradingAssignment[]> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.testSet', 'testSet')
      .where('testSet.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('assignment.asn_status = :status', { status: filters.status });
    }

    if (filters.search) {
      qb.andWhere('testSet.tst_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('assignment.asn_created_at', 'DESC');
    const assignments = await qb.getMany();
    return Promise.all(assignments.map((assignment) => this.buildGradingAssignment(assignment)));
  }

  async getGradingDetail(assignmentId: number): Promise<MapGradingDetail | null> {
    const assignment = await this.assignmentRepo.findOne({
      where: { asnId: assignmentId },
      relations: ['testSet'],
    });

    if (!assignment) {
      return null;
    }

    const gradingAssignment = await this.buildGradingAssignment(assignment);
    const testSet = await this.testSetRepo.findOne({
      where: { tstId: Number(assignment.tstId) },
      relations: ['items'],
    });
    const totalPoints = Number(testSet?.tstTotalPoints ?? 0);

    const responses = await this.responseRepo.find({
      where: { asnId: assignmentId },
      relations: ['student', 'item'],
      order: { rspSubmittedAt: 'ASC' },
    });
    const scores = await this.repo.find({ where: { asnId: assignmentId }, relations: ['student'] });
    const targetStudents = await this.getTargetStudents(assignment);
    const scoreMap = new Map(scores.map((score) => [Number(score.stdId), score]));

    const responsesByStudent = new Map<number, MapResponseEntity[]>();
    for (const response of responses) {
      const studentId = Number(response.stdId);
      const existing = responsesByStudent.get(studentId) ?? [];
      existing.push(response);
      responsesByStudent.set(studentId, existing);
    }

    const studentResults: MapGradingStudentResult[] = targetStudents.map((student) => {
      const studentId = Number(student.stdId);
      const studentResponses = responsesByStudent.get(studentId) ?? [];
      const earnedPoints = studentResponses.reduce((sum, item) => sum + Number(item.rspPointsEarned ?? 0), 0);
      const correctResponses = studentResponses.filter((item) => Boolean(item.rspIsCorrect)).length;
      const latestSubmittedAt =
        studentResponses.length > 0
          ? studentResponses.reduce((latest, item) =>
              !latest || item.rspSubmittedAt > latest ? item.rspSubmittedAt : latest,
            null as Date | null)
          : null;
      const latestScore = scoreMap.get(studentId);
      const scoreRate = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

      return {
        studentId,
        studentName: student.stdName,
        submittedAt: latestSubmittedAt,
        totalResponses: studentResponses.length,
        correctResponses,
        earnedPoints,
        totalPoints,
        scoreRate,
        gradingStatus: latestScore ? 'GRADED' : studentResponses.length > 0 ? 'SUBMITTED' : 'PENDING',
        latestScoreId: latestScore ? Number(latestScore.mscId) : null,
      };
    });

    const itemInsights = this.buildItemInsights(responses);
    const partAResponses = responses.filter((response) => response.item?.itmItemType === 'PART_A');
    const partBResponses = responses.filter((response) => response.item?.itmItemType === 'PART_B');
    const averageReadingScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, score) => sum + Number(score.mscReadingScore ?? 0), 0) / scores.length,
          )
        : null;

    return {
      assignment: gradingAssignment,
      totalPoints,
      averageReadingScore,
      partACorrectRate: this.computeCorrectRate(partAResponses),
      partBCorrectRate: this.computeCorrectRate(partBResponses),
      studentResults,
      itemInsights,
    };
  }

  async gradeAssignment(assignmentId: number): Promise<MapGradingDetail> {
    const assignment = await this.assignmentRepo.findOne({ where: { asnId: assignmentId }, relations: ['testSet'] });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const testSet = await this.testSetRepo.findOne({
      where: { tstId: Number(assignment.tstId) },
      relations: ['items'],
    });
    const snapshotMap = new Map(
      (testSet?.items ?? []).map((item) => [Number(item.itmId), item.tsiItemVersionSnapshot as Record<string, unknown>]),
    );

    const responses = await this.responseRepo.find({ where: { asnId: assignmentId }, relations: ['item'] });
    const grouped = new Map<number, MapResponseEntity[]>();
    for (const response of responses) {
      const snapshot = snapshotMap.get(Number(response.itmId));
      const answerKeys = this.normalizeAnswers(snapshot?.answerKeys ?? response.item?.itmAnswerKeys ?? []);
      const submittedAnswers = this.normalizeAnswers(response.rspAnswer);
      const isCorrect = this.areAnswersEqual(submittedAnswers, answerKeys);
      const points = Number(snapshot?.points ?? response.item?.itmPoints ?? 0);

      response.rspIsCorrect = isCorrect;
      response.rspPointsEarned = isCorrect ? points : 0;
      await this.responseRepo.save(response);

      const studentId = Number(response.stdId);
      const bucket = grouped.get(studentId) ?? [];
      bucket.push(response);
      grouped.set(studentId, bucket);
    }

    const today = new Date().toISOString().slice(0, 10);
    for (const [studentId, studentResponses] of grouped.entries()) {
      const readingScore = studentResponses.reduce((sum, response) => sum + Number(response.rspPointsEarned ?? 0), 0);
      const existing = await this.repo.findOne({ where: { asnId: assignmentId, stdId: studentId } });

      if (existing) {
        await this.repo.update(
          { mscId: Number(existing.mscId) },
          {
            mscAssessedAt: today,
            mscReadingScore: readingScore,
            mscSource: 'SYSTEM',
            mscNote: 'Auto graded from MAP responses',
          },
        );
      } else {
        await this.repo.save(
          this.repo.create({
            stdId: studentId,
            asnId: assignmentId,
            mscAssessedAt: today,
            mscReadingScore: readingScore,
            mscMathScore: null,
            mscLanguageScore: null,
            mscSource: 'SYSTEM',
            mscNote: 'Auto graded from MAP responses',
          }),
        );
      }
    }

    const detail = await this.getGradingDetail(assignmentId);
    if (!detail) {
      throw new NotFoundException('Assignment not found');
    }

    return detail;
  }

  async getPortalScoreHistory(params: {
    academyId: number;
    userEmail: string;
    role: string;
    studentId?: number;
    parentId?: number;
  }): Promise<MapPortalScoreHistory> {
    const matchedParent = params.parentId
      ? await this.parentRepo.findOne({ where: { acdId: params.academyId, prtId: params.parentId } })
      : await this.findParentByEmail(params.academyId, params.userEmail);
    const students = await this.resolvePortalStudents(params, matchedParent);
    const selectedStudent =
      (params.studentId ? students.find((student) => Number(student.stdId) === params.studentId) : undefined) ??
      students[0] ??
      null;

    const history = new MapPortalScoreHistory();
    history.accessMode = matchedParent
      ? 'PARENT'
      : params.role === 'PARENT'
        ? 'PARENT_UNBOUND'
        : 'ACADEMY_PREVIEW';
    history.selectedStudentId = selectedStudent ? Number(selectedStudent.stdId) : null;
    history.selectedStudentName = selectedStudent?.stdName ?? null;
    history.students = students.map((student) => this.toPortalStudent(student));

    if (!selectedStudent) {
      history.summary = null;
      history.scores = [];
      return history;
    }

    const scores = await this.repo.find({
      where: { stdId: Number(selectedStudent.stdId) },
      relations: ['student', 'assignment'],
      order: { mscAssessedAt: 'ASC', mscCreatedAt: 'ASC' },
    });
    const domainScores = scores.map((score) => this.toDomain(score));

    history.summary = this.buildPortalSummary(domainScores);
    history.scores = domainScores;
    return history;
  }

  private normalizeAnswers(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim().toUpperCase()).sort();
    }

    if (value === null || value === undefined) {
      return [];
    }

    return [String(value).trim().toUpperCase()];
  }

  private async resolvePortalStudents(params: {
    academyId: number;
    userEmail: string;
    role: string;
    studentId?: number;
    parentId?: number;
  }, matchedParent: ParentEntity | null): Promise<StudentEntity[]> {
    if (matchedParent) {
      const students = await this.getStudentsForParent(params.academyId, Number(matchedParent.prtId));
      return this.sortStudents(students);
    }

    if (params.role !== 'PARENT') {
      const students = await this.studentRepo.find({
        where: { acdId: params.academyId, stdStatus: 'ACTIVE' },
        order: { stdName: 'ASC' },
      });

      if (params.studentId) {
        return students.filter((student) => Number(student.stdId) === params.studentId);
      }

      return students;
    }

    return [];
  }

  private async findParentByEmail(academyId: number, email: string): Promise<ParentEntity | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const parents = await this.parentRepo.find({ where: { acdId: academyId } });

    for (const parent of parents) {
      const parentEmail = parent.prtEmailEncrypted?.toString('utf-8').trim().toLowerCase();
      if (parentEmail && parentEmail === normalizedEmail) {
        return parent;
      }
    }

    return null;
  }

  private async getStudentsForParent(academyId: number, parentId: number): Promise<StudentEntity[]> {
    const primaryStudents = await this.studentRepo.find({
      where: { acdId: academyId, prtId: parentId, stdStatus: 'ACTIVE' },
    });
    const guardianRows = await this.studentGuardianRepo.find({
      where: { prtId: parentId },
      relations: ['student'],
    });

    const deduped = new Map<number, StudentEntity>();
    for (const student of primaryStudents) {
      deduped.set(Number(student.stdId), student);
    }
    for (const row of guardianRows) {
      if (row.student && Number(row.student.acdId) === academyId && row.student.stdStatus === 'ACTIVE') {
        deduped.set(Number(row.student.stdId), row.student);
      }
    }

    return this.sortStudents(Array.from(deduped.values()));
  }

  private sortStudents(students: StudentEntity[]): StudentEntity[] {
    return students.sort((left, right) => left.stdName.localeCompare(right.stdName, 'ko'));
  }

  private toPortalStudent(student: StudentEntity): MapPortalStudentOption {
    const item = new MapPortalStudentOption();
    item.studentId = Number(student.stdId);
    item.studentName = student.stdName;
    item.gradeLevel = student.stdGrade;
    item.school = student.stdSchool;
    return item;
  }

  private buildPortalSummary(scores: MapScore[]): MapPortalScoreSummary | null {
    if (scores.length === 0) {
      return null;
    }

    const latest = scores[scores.length - 1];
    const first = scores[0];
    const readingScores = scores
      .map((score) => score.readingScore)
      .filter((score): score is number => score !== null && score !== undefined);

    const summary = new MapPortalScoreSummary();
    summary.latestAssessedAt = latest.assessedAt;
    summary.latestReadingScore = latest.readingScore;
    summary.latestMathScore = latest.mathScore;
    summary.latestLanguageScore = latest.languageScore;
    summary.averageReadingScore =
      readingScores.length > 0
        ? Math.round(readingScores.reduce((sum, score) => sum + score, 0) / readingScores.length)
        : null;
    summary.bestReadingScore = readingScores.length > 0 ? Math.max(...readingScores) : null;
    summary.readingDelta =
      latest.readingScore !== null && first.readingScore !== null
        ? latest.readingScore - first.readingScore
        : null;
    summary.assessmentsCount = scores.length;
    return summary;
  }

  private areAnswersEqual(submittedAnswers: string[], answerKeys: string[]): boolean {
    if (submittedAnswers.length !== answerKeys.length) {
      return false;
    }

    return submittedAnswers.every((answer, index) => answer === answerKeys[index]);
  }

  private toDomain(entity: MapScoreEntity): MapScore {
    const score = new MapScore();
    score.id = Number(entity.mscId);
    score.studentId = Number(entity.stdId);
    score.studentName = entity.student?.stdName ?? null;
    score.assignmentId = entity.asnId !== null ? Number(entity.asnId) : null;
    score.assessedAt = entity.mscAssessedAt;
    score.readingScore = entity.mscReadingScore;
    score.mathScore = entity.mscMathScore;
    score.languageScore = entity.mscLanguageScore;
    score.source = entity.mscSource;
    score.note = entity.mscNote;
    score.createdAt = entity.mscCreatedAt;
    return score;
  }

  private async buildGradingAssignment(entity: MapAssignmentEntity): Promise<MapGradingAssignment> {
    const item = new MapGradingAssignment();
    item.assignmentId = Number(entity.asnId);
    item.testSetId = Number(entity.tstId);
    item.testSetName = entity.testSet?.tstName ?? null;
    item.targetType = entity.asnTargetType;
    item.targetId = Number(entity.asnTargetId);
    item.dueAt = entity.asnDueAt;
    item.status = entity.asnStatus;

    const targetStudents = await this.getTargetStudents(entity);
    const scoreRows = await this.repo.find({ where: { asnId: Number(entity.asnId) } });
    const submittedCount = await this.responseRepo
      .createQueryBuilder('response')
      .where('response.asn_id = :assignmentId', { assignmentId: Number(entity.asnId) })
      .select('COUNT(DISTINCT response.std_id)', 'count')
      .getRawOne<{ count: string }>();

    item.targetName = await this.resolveTargetName(entity);
    item.totalTargets = targetStudents.length;
    item.submittedTargets = Number(submittedCount?.count ?? 0);
    item.gradedTargets = scoreRows.length;
    item.averageReadingScore =
      scoreRows.length > 0
        ? Math.round(scoreRows.reduce((sum, score) => sum + Number(score.mscReadingScore ?? 0), 0) / scoreRows.length)
        : null;
    return item;
  }

  private async getTargetStudents(assignment: MapAssignmentEntity): Promise<StudentEntity[]> {
    if (assignment.asnTargetType === 'STUDENT') {
      const student = await this.studentRepo.findOne({ where: { stdId: Number(assignment.asnTargetId) } });
      return student ? [student] : [];
    }

    const enrollments = await this.enrollmentRepo.find({
      where: { clsId: Number(assignment.asnTargetId), enrStatus: 'CONFIRMED' },
      relations: ['student'],
    });
    return enrollments.map((enrollment) => enrollment.student).filter(Boolean);
  }

  private async resolveTargetName(assignment: MapAssignmentEntity): Promise<string | null> {
    if (assignment.asnTargetType === 'STUDENT') {
      const student = await this.studentRepo.findOne({ where: { stdId: Number(assignment.asnTargetId) } });
      return student?.stdName ?? null;
    }

    const classEntity = await this.classRepo.findOne({
      where: { clsId: Number(assignment.asnTargetId) },
      relations: ['program'],
    });
    return classEntity?.program?.prgName ?? `Class #${assignment.asnTargetId}`;
  }

  private buildItemInsights(responses: MapResponseEntity[]): MapGradingItemInsight[] {
    const grouped = new Map<number, MapResponseEntity[]>();
    for (const response of responses) {
      const itemId = Number(response.itmId);
      const bucket = grouped.get(itemId) ?? [];
      bucket.push(response);
      grouped.set(itemId, bucket);
    }

    return Array.from(grouped.entries()).map(([itemId, itemResponses]) => {
      const correctCount = itemResponses.filter((response) => Boolean(response.rspIsCorrect)).length;
      const incorrectCount = itemResponses.length - correctCount;
      const first = itemResponses[0];
      return {
        itemId,
        itemType: first.item?.itmItemType ?? 'UNKNOWN',
        stem: first.item?.itmStem ?? `Item #${itemId}`,
        correctCount,
        incorrectCount,
        correctRate: itemResponses.length > 0 ? Math.round((correctCount / itemResponses.length) * 100) : 0,
      };
    });
  }

  private computeCorrectRate(responses: MapResponseEntity[]): number {
    if (responses.length === 0) {
      return 0;
    }

    const correct = responses.filter((response) => Boolean(response.rspIsCorrect)).length;
    return Math.round((correct / responses.length) * 100);
  }

  /* ── Hub Stats ── */

  async getHubStats(academyId: number): Promise<MapHubStats> {
    // Passages count + grade breakdown
    const passages = await this.passageRepo.find({
      where: { acdId: academyId },
      select: ['psgId', 'psgGradeLevel'],
    });
    const gradeMap = new Map<string, number>();
    for (const p of passages) {
      const label = p.psgGradeLevel ?? 'Unknown';
      gradeMap.set(label, (gradeMap.get(label) ?? 0) + 1);
    }
    const passagesByGrade: MapHubGradeBreakdown[] = Array.from(gradeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, count }));

    // Items count + Part A/B breakdown
    const items = await this.itemRepo.find({
      where: { acdId: academyId },
      select: ['itmId', 'itmDomain'],
    });
    let partAItems = 0;
    let partBItems = 0;
    for (const item of items) {
      const domain = (item.itmDomain ?? '').toUpperCase();
      if (domain.includes('VOCABULARY') || domain === 'PART_A') {
        partAItems++;
      } else {
        partBItems++;
      }
    }

    // TestSets count + status breakdown
    const testSets = await this.testSetRepo.find({
      where: { acdId: academyId },
      select: ['tstId', 'tstStatus'],
    });
    let publishedTestSets = 0;
    let draftTestSets = 0;
    for (const ts of testSets) {
      if (ts.tstStatus === 'PUBLISHED') {
        publishedTestSets++;
      } else {
        draftTestSets++;
      }
    }

    // Month assignments — join through testSet to filter by academyId
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAssignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .innerJoin('a.testSet', 'ts')
      .where('ts.acdId = :academyId', { academyId })
      .andWhere('a.asnCreatedAt >= :monthStart', { monthStart })
      .getMany();

    // Average reading score for this month's scores
    const monthScores = await this.repo
      .createQueryBuilder('s')
      .innerJoin('s.student', 'st')
      .where('st.acdId = :academyId', { academyId })
      .andWhere('s.mscCreatedAt >= :monthStart', { monthStart })
      .andWhere('s.mscReadingScore IS NOT NULL')
      .getMany();

    let monthAverageScore: number | null = null;
    if (monthScores.length > 0) {
      const sum = monthScores.reduce((acc, s) => acc + (s.mscReadingScore ?? 0), 0);
      monthAverageScore = Math.round((sum / monthScores.length) * 10) / 10;
    }

    // Pending grading
    const pendingGrading = await this.assignmentRepo
      .createQueryBuilder('a')
      .innerJoin('a.testSet', 'ts')
      .where('ts.acdId = :academyId', { academyId })
      .andWhere('a.asnStatus IN (:...statuses)', { statuses: ['ASSIGNED', 'IN_PROGRESS'] })
      .getCount();

    const stats = new MapHubStats();
    stats.passages = passages.length;
    stats.passagesByGrade = passagesByGrade;
    stats.items = items.length;
    stats.partAItems = partAItems;
    stats.partBItems = partBItems;
    stats.testSets = testSets.length;
    stats.publishedTestSets = publishedTestSets;
    stats.draftTestSets = draftTestSets;
    stats.monthAssignments = monthAssignments.length;
    stats.monthAverageScore = monthAverageScore;
    stats.pendingGrading = pendingGrading;
    return stats;
  }
}