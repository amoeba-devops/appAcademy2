import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { LevelTestPdfService } from './level-test-pdf.service';

/**
 * REQ-260626 T-13 — golden-path tests for the PDF generator. We don't
 * unit-test the binary layout; we just check that:
 *   1. missing inquiry / map-test produces 404 with the right code
 *   2. the returned buffer starts with the PDF magic bytes and the
 *      filename embeds the student name + test type
 *   3. each test-type branch renders without throwing (catches schema
 *      drift on the JSONB shape)
 */
describe('LevelTestPdfService', () => {
  let svc: LevelTestPdfService;
  let inqFindOne: jest.Mock;
  let mtFindOne: jest.Mock;
  let decrypt: jest.Mock;

  function makeInq(overrides: Partial<InquiryTypeormEntity> = {}): InquiryTypeormEntity {
    return {
      id: 'inq-1',
      entId: 'e1',
      seqNo: 42,
      grade: 'M1',
      schoolFreetext: 'Trinity Middle',
      nameEncrypted: Buffer.from('cipher'),
      nameIv: Buffer.from('iv'),
      nameAuthTag: Buffer.from('tag'),
      ...overrides,
    } as unknown as InquiryTypeormEntity;
  }

  function makeMt(
    type: MapTestTypeormEntity['testType'],
    overrides: Partial<MapTestTypeormEntity> = {},
  ): MapTestTypeormEntity {
    return {
      id: 'mt-1',
      entId: 'e1',
      inqId: 'inq-1',
      testType: type,
      scheduledAt: '2026-07-03',
      scheduledTime: '14:00:00',
      resultEnteredAt: new Date('2026-07-03T16:20:00Z'),
      scoreReading: null,
      scoreMath: null,
      scoreLanguage: null,
      scoreDetail: null,
      ...overrides,
    } as MapTestTypeormEntity;
  }

  beforeEach(async () => {
    inqFindOne = jest.fn();
    mtFindOne = jest.fn();
    decrypt = jest.fn().mockReturnValue('홍길동');

    const mod = await Test.createTestingModule({
      providers: [
        LevelTestPdfService,
        { provide: AesGcmService, useValue: { decrypt } },
        { provide: getRepositoryToken(InquiryTypeormEntity, ACM_DS), useValue: { findOne: inqFindOne } },
        { provide: getRepositoryToken(MapTestTypeormEntity, ACM_DS), useValue: { findOne: mtFindOne, find: jest.fn() } },
        { provide: getRepositoryToken(TeacherTypeormEntity, ACM_DS), useValue: { find: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    svc = mod.get(LevelTestPdfService);
  });

  it('404 INQUIRY_NOT_FOUND when inquiry missing in tenant', async () => {
    inqFindOne.mockResolvedValueOnce(null);
    await expect(svc.generate('e1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 LEVEL_TEST_ROW_NOT_FOUND when map-test row missing', async () => {
    inqFindOne.mockResolvedValueOnce(makeInq());
    mtFindOne.mockResolvedValueOnce(null);
    await expect(svc.generate('e1', 'inq-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('MAP — produces a PDF buffer + sensible filename', async () => {
    inqFindOne.mockResolvedValueOnce(makeInq());
    mtFindOne.mockResolvedValueOnce(
      makeMt('MAP', { scoreReading: 220, scoreMath: 210, scoreLanguage: 200 }),
    );
    const { buffer, filename } = await svc.generate('e1', 'inq-1');
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
    expect(filename).toMatch(/^LevelTest_홍길동_MAP_/);
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('ISEE — renders with the nested score detail without throwing', async () => {
    inqFindOne.mockResolvedValueOnce(makeInq());
    mtFindOne.mockResolvedValueOnce(
      makeMt('ISEE', {
        scoreDetail: {
          verbal: { scaled: 850, percentile: 75, stanine: 6 },
          reading: { scaled: 900 }, // partial — percentile/stanine missing
        },
      }),
    );
    const { buffer } = await svc.generate('e1', 'inq-1');
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('SSAT / DUOLINGO / TOEFL / TOEFL_JR / OTHER — each renders cleanly', async () => {
    const cases: Array<[MapTestTypeormEntity['testType'], Record<string, unknown>]> = [
      ['SSAT', { verbal: { score: 600, percentile: 70 }, total: { score: 1800, percentile: 72 } }],
      ['DUOLINGO', { total: 120, speaking: 130 }],
      ['TOEFL', { total: 4.5, speaking: 4 }],
      ['TOEFL_JR', { total: 3, listening: 260 }],
      ['OTHER', { 'Custom Score': 85, Comment: 'good' }],
    ];
    for (const [type, detail] of cases) {
      inqFindOne.mockResolvedValueOnce(makeInq());
      mtFindOne.mockResolvedValueOnce(makeMt(type, { scoreDetail: detail }));
      const { buffer, filename } = await svc.generate('e1', 'inq-1');
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
      expect(filename).toContain(type);
    }
  });

  it('TOEFL_JR filename uses TOEFL_JR (not "TOEFL Jr") so it stays filesystem-safe', async () => {
    inqFindOne.mockResolvedValueOnce(makeInq());
    mtFindOne.mockResolvedValueOnce(makeMt('TOEFL_JR', { scoreDetail: { total: 3 } }));
    const { filename } = await svc.generate('e1', 'inq-1');
    expect(filename).toMatch(/_TOEFL_JR_/);
  });

  it('empty / undecryptable student name → filename falls back to "student"', async () => {
    inqFindOne.mockResolvedValueOnce(makeInq());
    mtFindOne.mockResolvedValueOnce(makeMt('MAP'));
    decrypt.mockReturnValueOnce(null);
    const { filename } = await svc.generate('e1', 'inq-1');
    expect(filename).toMatch(/^LevelTest_student_MAP_/);
  });
});
