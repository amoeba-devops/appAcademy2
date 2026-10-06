import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ComplaintTypeormEntity } from '../infrastructure/typeorm/complaint.typeorm-entity';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  SearchComplaintsDto,
} from './dto/complaint.dto';
import { DailyKpiService } from './daily-kpi.service';

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);

  async search(entId: string, dto: SearchComplaintsDto) {
    if (
      dto.from > dto.to ||
      (Date.parse(dto.to) - Date.parse(dto.from)) / 86400000 > 365
    ) {
      throw new BadRequestException('Choose a date range of at most 366 days');
    }
    const q = this.repo
      .createQueryBuilder('c')
      .where('c.ent_id = :entId', { entId })
      .andWhere('c.cmp_deleted_at IS NULL')
      .andWhere('c.cmp_date BETWEEN :from AND :to', {
        from: dto.from,
        to: dto.to,
      });
    if (dto.site === 'COMMON') q.andWhere('c.cmp_site IS NULL');
    else if (dto.site && dto.site !== 'ALL')
      q.andWhere('c.cmp_site = :site', { site: dto.site });
    if (dto.channel)
      q.andWhere('c.cmp_channel = :channel', { channel: dto.channel });
    if (dto.severity)
      q.andWhere('c.cmp_severity = :severity', { severity: dto.severity });
    if (dto.search?.trim())
      q.andWhere(
        '(c.cmp_subject ILIKE :search OR c.cmp_description ILIKE :search)',
        { search: `%${dto.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [items, total] = await q
      .orderBy('c.cmp_date', 'DESC')
      .addOrderBy('c.cmp_created_at', 'DESC')
      .addOrderBy('c.cmp_id', 'DESC')
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getManyAndCount();
    return { items, total, page: dto.page, limit: dto.limit };
  }

  async detail(entId: string, id: string) {
    const item = await this.findOne(entId, id);
    if (!item) throw new NotFoundException('Complaint not found');
    return item;
  }

  async qnaOptions(entId: string, search = '') {
    return this.repo.manager.query<Array<{ id: string; subject: string }>>(
      `SELECT qna_id AS id, subject FROM amb_acm_qna_question WHERE ent_id = $1 AND deleted_at IS NULL AND subject ILIKE $2 ORDER BY created_at DESC LIMIT 50`,
      [entId, `%${search.slice(0, 200)}%`],
    );
  }

  private async validateQna(entId: string, id?: string | null) {
    if (!id) return;
    const rows = await this.repo.manager.query<unknown[]>(
      'SELECT 1 FROM amb_acm_qna_question WHERE qna_id = $1 AND ent_id = $2 AND deleted_at IS NULL',
      [id, entId],
    );
    if (!rows.length) throw new BadRequestException('Linked Q&A not found');
  }

  private async refresh(entId: string, dates: string[]) {
    let statisticsPending = false;
    for (const date of new Set(dates)) {
      try {
        await this.dailyKpi.recomputeDay(entId, date, 'complaint_changed');
      } catch (error) {
        statisticsPending = true;
        this.logger.error(
          `Complaint saved; KPI refresh failed for ${date}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return statisticsPending;
  }

  constructor(
    @InjectRepository(ComplaintTypeormEntity, ACM_DS)
    private readonly repo: Repository<ComplaintTypeormEntity>,
    private readonly dailyKpi: DailyKpiService,
  ) {}

  list(entId: string, yearMonth: string) {
    return this.repo
      .createQueryBuilder('c')
      .where('c.ent_id = :entId', { entId })
      .andWhere(`TO_CHAR(c.cmp_date, 'YYYY-MM') = :ym`, { ym: yearMonth })
      .andWhere('c.cmp_deleted_at IS NULL')
      .orderBy('c.cmp_date', 'DESC')
      .getMany();
  }

  findOne(entId: string, id: string) {
    return this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
  }

  async create(entId: string, dto: CreateComplaintDto, actorId?: string) {
    await this.validateQna(entId, dto.linkedQnaId);
    const now = new Date();
    const inserted = await this.repo.save(
      this.repo.create({
        entId,
        date: dto.date,
        channel: dto.channel,
        severity: dto.severity ?? 'MEDIUM',
        subject: dto.subject ?? null,
        description: dto.description ?? null,
        linkedQnaId: dto.linkedQnaId ?? null,
        site: dto.site ?? null, // PLN-260914B
        createdBy: actorId ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const statisticsPending = await this.refresh(entId, [dto.date]);
    return { ...inserted, statisticsPending };
  }

  async update(entId: string, id: string, dto: UpdateComplaintDto) {
    const found = await this.findOne(entId, id);
    if (!found) throw new NotFoundException(`Complaint ${id} not found`);
    await this.validateQna(entId, dto.linkedQnaId);
    const result = await this.repo.update(
      {
        id,
        entId,
        deletedAt: IsNull(),
        updatedAt: new Date(dto.expectedUpdatedAt),
      },
      {
        date: dto.date ?? found.date,
        channel: dto.channel ?? found.channel,
        severity: dto.severity ?? found.severity,
        subject: dto.subject !== undefined ? dto.subject : found.subject,
        description:
          dto.description !== undefined ? dto.description : found.description,
        linkedQnaId:
          dto.linkedQnaId !== undefined ? dto.linkedQnaId : found.linkedQnaId,
        site: dto.site !== undefined ? dto.site : found.site,
        updatedAt: new Date(),
      },
    );
    if (!result.affected)
      throw new ConflictException('Complaint changed. Reload before editing.');
    const statisticsPending = await this.refresh(entId, [
      found.date,
      dto.date ?? found.date,
    ]);
    return { ...(await this.detail(entId, id)), statisticsPending };
  }

  async softDelete(entId: string, id: string) {
    const found = await this.findOne(entId, id);
    if (!found) throw new NotFoundException(`Complaint ${id} not found`);
    await this.repo.update(
      { id, entId, deletedAt: IsNull() },
      { deletedAt: new Date(), updatedAt: new Date() },
    );
    await this.dailyKpi.recomputeDay(entId, found.date, 'complaint_deleted');
  }
}
