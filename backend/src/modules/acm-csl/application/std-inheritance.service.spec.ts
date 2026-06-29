import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { StdInheritanceService } from './std-inheritance.service';

/**
 * REQ-260626 T-19 / Q-CSL-102 — covers the conservative matching rule
 * and the idempotent partial-overwrite semantics.
 */
describe('StdInheritanceService', () => {
  let svc: StdInheritanceService;
  let stdFind: jest.Mock;
  let stdSave: jest.Mock;
  let decrypt: jest.Mock;

  function makeInq(opts: { withPhone?: boolean } = {}): InquiryTypeormEntity {
    const base = {
      id: 'inq-1',
      entId: 'e1',
      nameEncrypted: Buffer.from('cipher'),
      nameIv: Buffer.from('iv'),
      nameAuthTag: Buffer.from('tag'),
    } as Record<string, unknown>;
    if (opts.withPhone) {
      base.phoneEncrypted = Buffer.from('pcipher');
      base.phoneIv = Buffer.from('piv');
      base.phoneAuthTag = Buffer.from('ptag');
    }
    return base as unknown as InquiryTypeormEntity;
  }
  function makeMt(overrides: Partial<MapTestTypeormEntity> = {}): MapTestTypeormEntity {
    return {
      id: 'mt-1',
      entId: 'e1',
      inqId: 'inq-1',
      scoreReading: 220,
      scoreMath: 210,
      scoreLanguage: 200,
      ...overrides,
    } as MapTestTypeormEntity;
  }

  beforeEach(async () => {
    stdFind = jest.fn();
    stdSave = jest.fn((row) => Promise.resolve(row));
    decrypt = jest.fn().mockReturnValue('홍길동');

    const mod = await Test.createTestingModule({
      providers: [
        StdInheritanceService,
        { provide: AesGcmService, useValue: { decrypt } },
        {
          provide: getRepositoryToken(StudentTypeormEntity, ACM_DS),
          useValue: { find: stdFind, save: stdSave },
        },
      ],
    }).compile();

    svc = mod.get(StdInheritanceService);
  });

  it('no map-test row → matched=0 applied=false (no decrypt, no find)', async () => {
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), null);
    expect(r).toEqual({ matched: 0, applied: false });
    expect(decrypt).not.toHaveBeenCalled();
    expect(stdFind).not.toHaveBeenCalled();
  });

  it('익명 inquiry → matched=0 applied=false (intentional skip)', async () => {
    decrypt.mockReturnValueOnce('익명');
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r).toEqual({ matched: 0, applied: false });
    expect(stdFind).not.toHaveBeenCalled();
  });

  it('empty / null decrypt → matched=0 applied=false', async () => {
    decrypt.mockReturnValueOnce(null);
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r).toEqual({ matched: 0, applied: false });
  });

  it('0 STD matches → matched=0 applied=false (no save)', async () => {
    stdFind.mockResolvedValueOnce([]);
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r).toEqual({ matched: 0, applied: false });
    expect(stdSave).not.toHaveBeenCalled();
  });

  it('2+ STD matches → ambiguous, no save', async () => {
    stdFind.mockResolvedValueOnce([
      { id: 'std-1', mapReading: null, mapMath: null, mapLanguage: null },
      { id: 'std-2', mapReading: null, mapMath: null, mapLanguage: null },
    ]);
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r).toEqual({ matched: 2, applied: false });
    expect(stdSave).not.toHaveBeenCalled();
  });

  it('1 match, all STD fields null → applies all 3 scores', async () => {
    stdFind.mockResolvedValueOnce([
      { id: 'std-1', mapReading: null, mapMath: null, mapLanguage: null },
    ]);
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r).toEqual({ matched: 1, applied: true, stdId: 'std-1' });
    expect(stdSave).toHaveBeenCalledWith(
      expect.objectContaining({ mapReading: 220, mapMath: 210, mapLanguage: 200 }),
    );
  });

  it('1 match, STD has Math already → only Reading + Language inherited (operator value preserved)', async () => {
    stdFind.mockResolvedValueOnce([
      { id: 'std-1', mapReading: null, mapMath: 195, mapLanguage: null },
    ]);
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r.applied).toBe(true);
    expect(stdSave).toHaveBeenCalledWith(
      expect.objectContaining({ mapReading: 220, mapMath: 195, mapLanguage: 200 }),
    );
  });

  it('1 match, all STD fields populated → no save (idempotent)', async () => {
    stdFind.mockResolvedValueOnce([
      { id: 'std-1', mapReading: 210, mapMath: 200, mapLanguage: 195 },
    ]);
    const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(r).toEqual({ matched: 1, applied: false, stdId: 'std-1' });
    expect(stdSave).not.toHaveBeenCalled();
  });

  it('1 match, mpt scores all null → no save (nothing to copy)', async () => {
    stdFind.mockResolvedValueOnce([
      { id: 'std-1', mapReading: null, mapMath: null, mapLanguage: null },
    ]);
    const r = await svc.inheritMapScoresOnClassStart(
      makeInq(),
      makeMt({ scoreReading: null, scoreMath: null, scoreLanguage: null }),
    );
    expect(r.applied).toBe(false);
    expect(stdSave).not.toHaveBeenCalled();
  });

  it('find query scoped by (entId, decryptedName, status=ACTIVE)', async () => {
    stdFind.mockResolvedValueOnce([]);
    await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
    expect(stdFind).toHaveBeenCalledWith({
      where: { entId: 'e1', name: '홍길동', status: 'ACTIVE' },
    });
  });

  // ── T-19 v2 tier 1 (name+phone) cases ────────────────────────────────────

  describe('T-19 v2 — name+phone tiered matching', () => {
    it('tier 1: 2 name matches + 1 phone match → applies to phone-match row', async () => {
      decrypt.mockReturnValueOnce('홍길동').mockReturnValueOnce('010-1234-5678');
      stdFind.mockResolvedValueOnce([
        { id: 'std-1', phone: '02-555-0000', mapReading: null, mapMath: null, mapLanguage: null },
        { id: 'std-2', phone: '010-1234-5678', mapReading: null, mapMath: null, mapLanguage: null },
      ]);
      const r = await svc.inheritMapScoresOnClassStart(makeInq({ withPhone: true }), makeMt());
      expect(r).toEqual({ matched: 1, applied: true, stdId: 'std-2' });
      expect(stdSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'std-2', mapReading: 220, mapMath: 210, mapLanguage: 200 }),
      );
    });

    it('tier 1: phone normalization equates +82 vs 010 forms', async () => {
      decrypt.mockReturnValueOnce('홍길동').mockReturnValueOnce('+82 10-1234-5678');
      stdFind.mockResolvedValueOnce([
        { id: 'std-1', phone: '02-555-0000', mapReading: null, mapMath: null, mapLanguage: null },
        { id: 'std-2', phone: '010-1234-5678', mapReading: null, mapMath: null, mapLanguage: null },
      ]);
      const r = await svc.inheritMapScoresOnClassStart(makeInq({ withPhone: true }), makeMt());
      expect(r.stdId).toBe('std-2');
      expect(r.applied).toBe(true);
    });

    it('tier 1: 2 phone matches → ambiguous, no save', async () => {
      decrypt.mockReturnValueOnce('홍길동').mockReturnValueOnce('010-1234-5678');
      stdFind.mockResolvedValueOnce([
        { id: 'std-1', phone: '010-1234-5678', mapReading: null, mapMath: null, mapLanguage: null },
        { id: 'std-2', phone: '01012345678',   mapReading: null, mapMath: null, mapLanguage: null },
      ]);
      const r = await svc.inheritMapScoresOnClassStart(makeInq({ withPhone: true }), makeMt());
      expect(r).toEqual({ matched: 2, applied: false });
      expect(stdSave).not.toHaveBeenCalled();
    });

    it('tier 2 fallback: phone present but no phone hit + 1 name match → applies', async () => {
      decrypt.mockReturnValueOnce('홍길동').mockReturnValueOnce('010-9999-8888');
      stdFind.mockResolvedValueOnce([
        { id: 'std-1', phone: '010-1111-2222', mapReading: null, mapMath: null, mapLanguage: null },
      ]);
      const r = await svc.inheritMapScoresOnClassStart(makeInq({ withPhone: true }), makeMt());
      expect(r).toEqual({ matched: 1, applied: true, stdId: 'std-1' });
    });

    it('tier 2: inquiry has no phone, 1 name match → applies (legacy v1 path)', async () => {
      // decrypt is only called for name now (no phone components on inq).
      decrypt.mockReturnValueOnce('홍길동');
      stdFind.mockResolvedValueOnce([
        { id: 'std-1', phone: null, mapReading: null, mapMath: null, mapLanguage: null },
      ]);
      const r = await svc.inheritMapScoresOnClassStart(makeInq(), makeMt());
      expect(r).toEqual({ matched: 1, applied: true, stdId: 'std-1' });
    });

    it('phone decrypt failure → falls back to tier 2 (name-only)', async () => {
      decrypt
        .mockReturnValueOnce('홍길동')
        .mockImplementationOnce(() => {
          throw new Error('GCM auth tag mismatch');
        });
      stdFind.mockResolvedValueOnce([
        { id: 'std-1', phone: '010-1234-5678', mapReading: null, mapMath: null, mapLanguage: null },
      ]);
      const r = await svc.inheritMapScoresOnClassStart(makeInq({ withPhone: true }), makeMt());
      expect(r.applied).toBe(true);
      expect(r.stdId).toBe('std-1');
    });
  });
});
