import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  MapAssignmentStatus,
  MapAssignmentTargetType,
  MapAssignmentTypeormEntity,
} from '../../infrastructure/typeorm/map-assignment.typeorm-entity';
import { MapResponseTypeormEntity } from '../../infrastructure/typeorm/map-response.typeorm-entity';

/**
 * MAP assignment lifecycle + student response collection.
 *
 *   create → ASSIGNED → IN_PROGRESS (student opens) → SUBMITTED
 *                                                    → GRADED
 *   any → CANCELED
 *
 * Response is UNIQUE (assignment, student, item) — UPSERT semantics
 * make grading retries idempotent.
 */
@Injectable()
export class MapAssignmentService {
  constructor(
    @InjectRepository(MapAssignmentTypeormEntity, ACM_DS)
    private readonly assignmentRepo: Repository<MapAssignmentTypeormEntity>,
    @InjectRepository(MapResponseTypeormEntity, ACM_DS)
    private readonly responseRepo: Repository<MapResponseTypeormEntity>,
  ) {}

  async findById(id: string): Promise<MapAssignmentTypeormEntity> {
    const row = await this.assignmentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'MAP_ASSIGNMENT_NOT_FOUND', id });
    return row;
  }

  async create(input: {
    testSetId: string;
    targetType: MapAssignmentTargetType;
    targetId: string;
    dueAt: Date;
  }): Promise<MapAssignmentTypeormEntity> {
    const row = this.assignmentRepo.create({
      testSetId: input.testSetId,
      targetType: input.targetType,
      targetId: input.targetId,
      dueAt: input.dueAt,
      status: 'ASSIGNED',
    });
    return this.assignmentRepo.save(row);
  }

  async transition(
    id: string,
    next: MapAssignmentStatus,
  ): Promise<MapAssignmentTypeormEntity> {
    const row = await this.findById(id);
    row.status = next;
    return this.assignmentRepo.save(row);
  }

  /** Student-side list — open assignments for a student. */
  async listForStudent(
    studentId: string,
  ): Promise<MapAssignmentTypeormEntity[]> {
    return this.assignmentRepo.find({
      where: {
        targetType: 'STUDENT',
        targetId: studentId,
        status: 'ASSIGNED',
      },
      order: { dueAt: 'ASC' },
    });
  }

  // -------- responses --------------------------------------------------

  /**
   * Idempotent UPSERT — same (assignment, student, item) overwrites the
   * previous answer (student changed their mind before submit).
   */
  async upsertResponse(input: {
    assignmentId: string;
    studentId: string;
    itemId: string;
    answer: unknown;
    isCorrect: boolean;
    pointsEarned: number;
  }): Promise<MapResponseTypeormEntity> {
    const existing = await this.responseRepo.findOne({
      where: {
        assignmentId: input.assignmentId,
        studentId: input.studentId,
        itemId: input.itemId,
      },
    });
    if (existing) {
      existing.answer = input.answer;
      existing.isCorrect = input.isCorrect;
      existing.pointsEarned = input.pointsEarned;
      existing.submittedAt = new Date();
      return this.responseRepo.save(existing);
    }
    return this.responseRepo.save(this.responseRepo.create({
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      itemId: input.itemId,
      answer: input.answer,
      isCorrect: input.isCorrect,
      pointsEarned: input.pointsEarned,
      submittedAt: new Date(),
    }));
  }

  async listResponses(
    assignmentId: string,
    studentId: string,
  ): Promise<MapResponseTypeormEntity[]> {
    return this.responseRepo.find({
      where: { assignmentId, studentId },
      order: { submittedAt: 'ASC' },
    });
  }

  /** Sum points earned across all items in this submission. */
  async totalScore(
    assignmentId: string,
    studentId: string,
  ): Promise<number> {
    const responses = await this.listResponses(assignmentId, studentId);
    return responses.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0);
  }
}
