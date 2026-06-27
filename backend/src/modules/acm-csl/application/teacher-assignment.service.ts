import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  AssignmentRole,
  TeacherAssignmentTypeormEntity,
} from '../infrastructure/typeorm/teacher-assignment.typeorm-entity';

/**
 * REQ-260626 FR-CSL-136 — multi-teacher assignment for an inquiry.
 *
 * Persists per-inquiry rows in amb_acm_csl_teacher_assignment with role
 * PRIMARY/SECONDARY. uq(inq_id, tch_id) — repeated assign with the same
 * teacher upgrades/downgrades the role rather than 409'ing. Delete is
 * by row id (not pair) so the operator can identify which assignment to
 * remove from the UI list.
 */
@Injectable()
export class TeacherAssignmentService {
  constructor(
    @InjectRepository(TeacherAssignmentTypeormEntity, ACM_DS)
    private readonly repo: Repository<TeacherAssignmentTypeormEntity>,
  ) {}

  list(entId: string, inqId: string): Promise<TeacherAssignmentTypeormEntity[]> {
    return this.repo.find({
      where: { entId, inqId },
      order: { role: 'ASC', assignedAt: 'ASC' },
    });
  }

  /**
   * Add or upgrade an assignment. If (inq, tch) already exists, only the
   * role is updated (idempotent) and the audit fields (assignedBy/At)
   * are stamped fresh.
   */
  async assign(input: {
    entId: string;
    inqId: string;
    teacherId: string;
    role: AssignmentRole;
    actorId: string;
  }): Promise<TeacherAssignmentTypeormEntity> {
    const existing = await this.repo.findOne({
      where: { inqId: input.inqId, teacherId: input.teacherId },
    });
    if (existing) {
      existing.role = input.role;
      existing.assignedBy = input.actorId;
      existing.assignedAt = new Date();
      return this.repo.save(existing);
    }
    try {
      return await this.repo.save(
        this.repo.create({
          entId: input.entId,
          inqId: input.inqId,
          teacherId: input.teacherId,
          role: input.role,
          assignedBy: input.actorId,
          assignedAt: new Date(),
        }),
      );
    } catch (e: unknown) {
      // Defensive: another request may have raced and inserted the pair
      // between our findOne and save. Surface as 409 for the client to retry.
      if (
        e instanceof Error &&
        /unique|duplicate/i.test(e.message)
      ) {
        throw new ConflictException('Teacher already assigned to this inquiry');
      }
      throw e;
    }
  }

  async remove(entId: string, inqId: string, asgId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { entId, inqId, id: asgId } });
    if (!row) {
      throw new NotFoundException({ code: 'TEACHER_ASSIGNMENT_NOT_FOUND', asgId });
    }
    await this.repo.delete({ id: asgId });
  }
}
