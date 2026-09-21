import { MapApplyService } from './map-apply.service';
import type { Repository } from 'typeorm';
import type { InquiryService } from './inquiry.service';
import type { MapApplyNotifierService } from './map-apply-notifier.service';
import type { MapApplyTypeormEntity } from '../infrastructure/typeorm/map-apply.typeorm-entity';
import type { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import type { ImportMapApplyDto } from './dto/map-apply.dto';

/** CSL-PLN-260916 — 생년월일 정규화 / 이관 멱등·집계. */
describe('MapApplyService', () => {
  describe('normalizeBirthdate', () => {
    it('accepts YYYYMMDD and separator variants', () => {
      for (const raw of [
        '20100914',
        '2010-09-14',
        '2010.09.14',
        '2010 09 14',
      ]) {
        expect(MapApplyService.normalizeBirthdate(raw)).toEqual({
          date: '2010-09-14',
          raw,
        });
      }
    });

    it('keeps the raw text when it cannot be parsed', () => {
      expect(MapApplyService.normalizeBirthdate('2010년 9월')).toEqual({
        date: null,
        raw: '2010년 9월',
      });
      // 달력에 없는 날짜는 원문 보존
      expect(MapApplyService.normalizeBirthdate('20100230')).toEqual({
        date: null,
        raw: '20100230',
      });
    });

    it('treats blank input as empty', () => {
      expect(MapApplyService.normalizeBirthdate('  ')).toEqual({
        date: null,
        raw: null,
      });
      expect(MapApplyService.normalizeBirthdate(undefined)).toEqual({
        date: null,
        raw: null,
      });
    });
  });

  describe('importRows', () => {
    let repo: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
      createQueryBuilder: jest.Mock;
    };
    let inquiryService: { create: jest.Mock; toView: jest.Mock };
    let svc: MapApplyService;
    let seq: number;

    const rowsOf = (): ImportMapApplyDto => ({
      site: 'TPI',
      rows: [
        {
          submittedAt: '2026-09-01 11:05',
          studentName: '주지호',
          studentNameEn: 'Joo Jiho',
          birthdate: '20100914',
          grade: 'G10',
          gender: 'M',
          parentPhone: '01033947779',
          examLocation: '싱가포르',
          preferredSlot: '금요일 오후 5시',
        },
        {
          submittedAt: 'not-a-date',
          studentName: '깨진행',
        },
      ],
    });

    beforeEach(() => {
      seq = 100;
      repo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((v: unknown) => v),
        save: jest.fn(async (v: unknown) => v),
        createQueryBuilder: jest.fn(),
      };
      inquiryService = {
        create: jest.fn(async () => ({ id: `inq-${++seq}`, seqNo: seq })),
        toView: jest.fn(),
      };
      svc = new MapApplyService(
        repo as unknown as Repository<MapApplyTypeormEntity>,
        {} as unknown as Repository<InquiryTypeormEntity>,
        inquiryService as unknown as InquiryService,
        {
          notifyNewApplication: jest.fn(),
        } as unknown as MapApplyNotifierService,
      );
    });

    it('imports valid rows, reports the malformed one, and never notifies', async () => {
      const r = await svc.importRows('ent-1', rowsOf());
      expect(r).toMatchObject({ inserted: 1, skipped: 0, failed: 1 });
      expect(r.errors[0]).toEqual({ index: 1, reason: 'INVALID_SUBMITTED_AT' });
      // 이관 건은 WEB_EXTERNAL/EXAM_ONLY 로 상담을 만들고 원래 작성일을 등록일로 쓴다
      expect(inquiryService.create).toHaveBeenCalledWith(
        'ent-1',
        expect.objectContaining({
          studentName: '주지호',
          inflowType: 'WEB_EXTERNAL',
          applyType: 'EXAM_ONLY',
          sourceSite: 'TPI',
          registeredAt: '2026-09-01',
        }),
      );
      const saved = repo.save.mock.calls[0][0] as MapApplyTypeormEntity;
      expect(saved.origin).toBe('IMPORT');
      expect(saved.birthdate).toBe('2010-09-14');
      expect(saved.importKey).toContain('TPI|');
    });

    it('skips rows already imported (idempotent re-run)', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' });
      const r = await svc.importRows('ent-1', rowsOf());
      expect(r).toMatchObject({ inserted: 0, skipped: 1, failed: 1 });
      expect(inquiryService.create).not.toHaveBeenCalled();
    });

    it('dryRun validates without writing', async () => {
      const r = await svc.importRows('ent-1', { ...rowsOf(), dryRun: true });
      expect(r).toMatchObject({ inserted: 1, failed: 1, dryRun: true });
      expect(inquiryService.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});

// REQ-260921B — 콘솔 등록/수정 상담을 맵테스트 부속 행에 반영.
describe('reflectInquiry', () => {
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let inqRepo: { findOne: jest.Mock; save: jest.Mock };
  let svc: MapApplyService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => v),
    };
    inqRepo = { findOne: jest.fn(), save: jest.fn(async (v: unknown) => v) };
    svc = new MapApplyService(
      repo as unknown as Repository<MapApplyTypeormEntity>,
      inqRepo as unknown as Repository<InquiryTypeormEntity>,
      {} as unknown as InquiryService,
      {} as unknown as MapApplyNotifierService,
    );
  });

  it('creates a CONSOLE map-apply row for a MAP_TEST inquiry without one', async () => {
    inqRepo.findOne.mockResolvedValue({
      id: 'inq-1',
      kind: 'MAP_TEST',
      birthdate: '2012-03-14',
      gender: 'F',
      sourceSite: null,
      siteOverride: 'TRINITY',
      createdAt: new Date('2026-09-21T00:00:00Z'),
    });
    repo.findOne.mockResolvedValue(null);

    await svc.reflectInquiry('ent-1', 'inq-1');

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        inqId: 'inq-1',
        origin: 'CONSOLE',
        birthdate: '2012-03-14',
        gender: 'F',
        sourceSite: 'TRINITY',
      }),
    );
  });

  it('does nothing for a TUTORING inquiry without a row', async () => {
    inqRepo.findOne.mockResolvedValue({ id: 'inq-2', kind: 'TUTORING' });
    repo.findOne.mockResolvedValue(null);
    await svc.reflectInquiry('ent-1', 'inq-2');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('syncs birthdate/gender into an existing row and clears raw text', async () => {
    inqRepo.findOne.mockResolvedValue({
      id: 'inq-3',
      kind: 'MAP_TEST',
      birthdate: '2011-01-02',
      gender: 'M',
    });
    const existing = {
      inqId: 'inq-3',
      birthdate: null,
      birthdateRaw: '2011년 1월',
      gender: null,
    };
    repo.findOne.mockResolvedValue(existing);

    await svc.reflectInquiry('ent-1', 'inq-3');

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        birthdate: '2011-01-02',
        birthdateRaw: null,
        gender: 'M',
      }),
    );
  });
});
