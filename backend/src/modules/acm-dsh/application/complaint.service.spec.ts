import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintService } from './complaint.service';
import { SearchComplaintsDto, UpdateComplaintDto } from './dto/complaint.dto';
import { validate } from 'class-validator';

const timestamp = new Date('2026-10-06T01:00:00.000Z');
const existing = {
  id: 'complaint',
  entId: 'tenant',
  date: '2026-10-01',
  site: 'TPI',
  channel: 'PHONE',
  severity: 'MEDIUM',
  subject: 'Before',
  description: 'Body',
  linkedQnaId: 'qna',
  updatedAt: timestamp,
};
describe('ComplaintService', () => {
  const repo = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn(),
    manager: { query: jest.fn() },
    createQueryBuilder: jest.fn(),
  };
  const kpi = { recomputeDay: jest.fn() };
  let service: ComplaintService;
  beforeEach(() => {
    jest.clearAllMocks();
    repo.findOne.mockResolvedValue(existing);
    repo.update.mockResolvedValue({ affected: 1 });
    kpi.recomputeDay.mockResolvedValue(undefined);
    service = new ComplaintService(repo as never, kpi as never);
  });
  it('clears nullable fields and recomputes both dates, with tenant and version constraints', async () => {
    await service.update('tenant', 'complaint', {
      expectedUpdatedAt: timestamp.toISOString(),
      date: '2026-10-02',
      site: null,
      subject: null,
      description: null,
      linkedQnaId: null,
    });
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'complaint',
        entId: 'tenant',
        updatedAt: timestamp,
        deletedAt: expect.anything(),
      }),
      expect.objectContaining({
        site: null,
        subject: null,
        description: null,
        linkedQnaId: null,
        date: '2026-10-02',
      }),
    );
    expect(
      kpi.recomputeDay.mock.calls.map((call: unknown[]) => call[1]),
    ).toEqual(['2026-10-01', '2026-10-02']);
  });
  it('rejects a stale edit without recomputing statistics', async () => {
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(
      service.update('tenant', 'complaint', {
        expectedUpdatedAt: timestamp.toISOString(),
        subject: 'After',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(kpi.recomputeDay).not.toHaveBeenCalled();
  });
  it('does not expose or modify another tenant record', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.update('other', 'complaint', {
        expectedUpdatedAt: timestamp.toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ entId: 'other', id: 'complaint' }),
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('rejects a missing or cross-tenant linked Q&A', async () => {
    repo.manager.query.mockResolvedValue([]);
    await expect(
      service.update('tenant', 'complaint', {
        expectedUpdatedAt: timestamp.toISOString(),
        linkedQnaId: 'foreign-qna',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('ent_id = $2'),
      ['foreign-qna', 'tenant'],
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('reports persistence success if subsequent KPI refresh fails', async () => {
    repo.save.mockResolvedValue(existing);
    kpi.recomputeDay.mockRejectedValue(new Error('unavailable'));
    const result = await service.create('tenant', {
      date: existing.date,
      channel: 'PHONE',
    });
    expect(result.statisticsPending).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
  it('scopes, filters and paginates search with escaped literal text', async () => {
    const query = {
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[existing], 21]),
    };
    for (const key of [
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ] as const)
      query[key].mockReturnValue(query);
    repo.createQueryBuilder.mockReturnValue(query);
    const result = await service.search(
      'tenant',
      Object.assign(new SearchComplaintsDto(), {
        from: '2026-10-01',
        to: '2026-10-31',
        site: 'COMMON',
        search: '%_',
        page: 2,
      }),
    );
    expect(query.where).toHaveBeenCalledWith('c.ent_id = :entId', {
      entId: 'tenant',
    });
    expect(query.andWhere).toHaveBeenCalledWith('c.cmp_site IS NULL');
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      { search: '%\\%\\_%' },
    );
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(result.total).toBe(21);
  });
  it('rejects reversed date ranges', async () => {
    await expect(
      service.search(
        'tenant',
        Object.assign(new SearchComplaintsDto(), {
          from: '2026-10-31',
          to: '2026-10-01',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('validates real dates, page limits and required concurrency token', async () => {
    expect(
      (
        await validate(
          Object.assign(new SearchComplaintsDto(), {
            from: '2026-02-30',
            to: '2026-10-01',
            limit: 101,
          }),
        )
      ).map((e) => e.property),
    ).toEqual(expect.arrayContaining(['from', 'limit']));
    expect(
      (
        await validate(
          Object.assign(new UpdateComplaintDto(), {
            date: null,
            channel: null,
          }),
        )
      ).map((e) => e.property),
    ).toEqual(expect.arrayContaining(['expectedUpdatedAt', 'date', 'channel']));
  });
});
