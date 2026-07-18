import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { ClassTypeormEntity } from '../infrastructure/typeorm/class.typeorm-entity';
import { ClsEnrollmentTypeormEntity } from '../infrastructure/typeorm/cls-enrollment.typeorm-entity';

@Injectable()
export class EnrollmentAdminService {
  constructor(
    @InjectRepository(ClsEnrollmentTypeormEntity, ACM_DS)
    private readonly enrollmentRepo: Repository<ClsEnrollmentTypeormEntity>,
  ) {}

  async list(
    entId: string,
    filters: {
      status?: string;
      classId?: string;
      studentId?: string;
    },
  ) {
    const qb = this.enrollmentRepo
      .createQueryBuilder('ce')
      .innerJoin(
        StudentTypeormEntity,
        's',
        's.std_id = ce.std_id AND s.deleted_at IS NULL',
      )
      .innerJoin(
        ParentTypeormEntity,
        'p',
        'p.par_id = ce.ce_applied_prt_id AND p.deleted_at IS NULL',
      )
      .innerJoin(
        ClassTypeormEntity,
        'cls',
        'cls.cls_id = ce.cls_id AND cls.cls_deleted_at IS NULL',
      )
      .where('ce.ent_id = :entId', { entId });

    if (filters.status) {
      qb.andWhere('ce.ce_status = :status', { status: filters.status });
    }
    if (filters.classId) {
      qb.andWhere('ce.cls_id = :classId', { classId: filters.classId });
    }
    if (filters.studentId) {
      qb.andWhere('ce.std_id = :studentId', { studentId: filters.studentId });
    }

    const rows = await qb
      .select('ce.ce_id', 'id')
      .addSelect('ce.cls_id', 'classId')
      .addSelect('ce.std_id', 'studentId')
      .addSelect('ce.ce_applied_prt_id', 'appliedParentId')
      .addSelect('ce.ce_status', 'status')
      .addSelect('ce.ce_applied_at', 'appliedAt')
      .addSelect('ce.ce_confirmed_at', 'confirmedAt')
      .addSelect('ce.ce_canceled_at', 'canceledAt')
      .addSelect('s.std_name', 'studentName')
      .addSelect('p.par_name', 'parentName')
      .addSelect('COALESCE(cls.cls_subject_label, cls.cls_code)', 'className')
      .addSelect('COALESCE(cls.cls_subject_label, cls.cls_code)', 'programName')
      .orderBy('ce.ce_applied_at', 'DESC')
      .limit(100)
      .getRawMany<{
        id: string;
        classId: string;
        studentId: string;
        appliedParentId: string;
        status: string;
        appliedAt: string;
        confirmedAt: string | null;
        canceledAt: string | null;
        studentName: string | null;
        parentName: string | null;
        className: string | null;
        programName: string | null;
      }>();

    return rows;
  }

  async updateStatus(
    entId: string,
    id: string,
    status: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'EXPIRED',
  ) {
    const row = await this.enrollmentRepo.findOne({ where: { entId, id } });
    if (!row) {
      throw new NotFoundException({ code: 'ENROLLMENT_NOT_FOUND', id });
    }
    row.status = status;
    if (status === 'CONFIRMED' && !row.confirmedAt) {
      row.confirmedAt = new Date();
    }
    if (status === 'CANCELED' && !row.canceledAt) {
      row.canceledAt = new Date();
    }
    if (status === 'PENDING') {
      row.confirmedAt = null;
      row.canceledAt = null;
    }
    return this.enrollmentRepo.save(row);
  }
}
