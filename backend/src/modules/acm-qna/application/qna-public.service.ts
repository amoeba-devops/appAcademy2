import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { QuestionTypeormEntity } from '../infrastructure/typeorm/question.typeorm-entity';

export interface QnaTimelineDto {
  id: string;
  subject: string;
  status: string;
  createdAt: Date;
  isFaqPromoted: boolean;
}

/**
 * Cross-module read-only facade for QNA.
 * Imported by DSH/CSL modules — exported via AcmQnaModule.
 */
@Injectable()
export class QnaPublicService {
  constructor(
    @InjectRepository(QuestionTypeormEntity, ACM_DS)
    private readonly repo: Repository<QuestionTypeormEntity>,
  ) {}

  async findByStudent(entId: string, studentId: string, limit = 20): Promise<QnaTimelineDto[]> {
    const items = await this.repo.find({
      where: { entId, studentId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return items.map((q) => ({
      id: q.id,
      subject: q.subject,
      status: q.status,
      createdAt: q.createdAt,
      isFaqPromoted: q.isFaqPromoted,
    }));
  }

  countOpenByStudent(entId: string, studentId: string): Promise<number> {
    return this.repo.count({
      where: {
        entId, studentId,
        status: In(['OPEN', 'RESPONDED', 'ESCALATED', 'DEFERRED']),
        deletedAt: IsNull(),
      },
    });
  }
}
