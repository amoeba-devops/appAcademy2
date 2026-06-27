import { BadRequestException } from '@nestjs/common';
import { validateLevelTestScoreDetail } from './level-test-score.validator';

/**
 * REQ-260626 §5.6 — guards the per-type score schemas. Drift here means
 * silent data corruption in the PDF + STD inheritance paths, so the
 * range / shape edges get individual coverage.
 */
describe('validateLevelTestScoreDetail', () => {
  it('returns null for empty / undefined detail (operator partial-save)', () => {
    expect(validateLevelTestScoreDetail('ISEE', undefined)).toBeNull();
    expect(validateLevelTestScoreDetail('ISEE', {})).toBeNull();
  });

  it('MAP rejects scoreDetail (must use dedicated columns)', () => {
    expect(() => validateLevelTestScoreDetail('MAP', { reading: 220 }))
      .toThrow(BadRequestException);
  });

  it('ISEE — accepts in-range per-section triples; rejects out-of-range', () => {
    const valid = validateLevelTestScoreDetail('ISEE', {
      verbal: { scaled: 850, percentile: 75, stanine: 6 },
      reading: { scaled: 900, percentile: 90, stanine: 8 },
    });
    expect(valid).toEqual({
      verbal: { scaled: 850, percentile: 75, stanine: 6 },
      reading: { scaled: 900, percentile: 90, stanine: 8 },
    });

    expect(() => validateLevelTestScoreDetail('ISEE', { verbal: { scaled: 700 } }))
      .toThrow(/scoreDetail\.verbal\.scaled.*\[760, 940\]/);
    expect(() => validateLevelTestScoreDetail('ISEE', { verbal: { percentile: 100 } }))
      .toThrow(/scoreDetail\.verbal\.percentile.*\[1, 99\]/);
    expect(() => validateLevelTestScoreDetail('ISEE', { verbal: { stanine: 10 } }))
      .toThrow(/scoreDetail\.verbal\.stanine.*\[1, 9\]/);
  });

  it('SSAT — section + total ranges enforced', () => {
    const valid = validateLevelTestScoreDetail('SSAT', {
      verbal: { score: 600, percentile: 70 },
      quantitative: { score: 580, percentile: 65 },
      reading: { score: 620, percentile: 75 },
      total: { score: 1800, percentile: 72 },
    });
    expect(valid).toMatchObject({ total: { score: 1800, percentile: 72 } });

    // section out of range
    expect(() => validateLevelTestScoreDetail('SSAT', { verbal: { score: 800 } }))
      .toThrow(/\[440, 710\]/);
    // total out of range
    expect(() => validateLevelTestScoreDetail('SSAT', { total: { score: 1000 } }))
      .toThrow(/\[1320, 2082\]/);
  });

  it('Duolingo — 10~160 enforced on every key', () => {
    const valid = validateLevelTestScoreDetail('DUOLINGO', {
      total: 120, speaking: 130, writing: 110, reading: 120, listening: 120,
      production: 115, literacy: 118, comprehension: 120, conversation: 125,
    });
    expect(valid).toEqual({
      total: 120, speaking: 130, writing: 110, reading: 120, listening: 120,
      production: 115, literacy: 118, comprehension: 120, conversation: 125,
    });
    expect(() => validateLevelTestScoreDetail('DUOLINGO', { total: 5 }))
      .toThrow(/\[10, 160\]/);
    expect(() => validateLevelTestScoreDetail('DUOLINGO', { total: 200 }))
      .toThrow(/\[10, 160\]/);
  });

  it('TOEFL — 1~6 by 0.5 step; rejects fractional non-half', () => {
    expect(validateLevelTestScoreDetail('TOEFL', {
      total: 4.5, speaking: 4, writing: 5, reading: 4.5, listening: 4.5,
    })).toEqual({ total: 4.5, speaking: 4, writing: 5, reading: 4.5, listening: 4.5 });
    expect(() => validateLevelTestScoreDetail('TOEFL', { total: 4.3 }))
      .toThrow(/0\.5-step/);
    expect(() => validateLevelTestScoreDetail('TOEFL', { total: 7 }))
      .toThrow(/0\.5-step/);
  });

  it('TOEFL Jr — total 0~5, sections 200~300', () => {
    expect(validateLevelTestScoreDetail('TOEFL_JR', {
      total: 3, listening: 260, lfm: 250, reading: 270,
    })).toEqual({ total: 3, listening: 260, lfm: 250, reading: 270 });
    expect(() => validateLevelTestScoreDetail('TOEFL_JR', { total: 6 }))
      .toThrow(/\[0, 5\]/);
    expect(() => validateLevelTestScoreDetail('TOEFL_JR', { lfm: 150 }))
      .toThrow(/\[200, 300\]/);
  });

  it('OTHER — flat scalar values pass through (numbers coerced)', () => {
    const out = validateLevelTestScoreDetail('OTHER', {
      'Custom Section': '85',
      'Comment': 'good',
    });
    expect(out).toEqual({ 'Custom Section': 85, 'Comment': 'good' });

    expect(() => validateLevelTestScoreDetail('OTHER', { nested: { x: 1 } }))
      .toThrow(/OTHER schema accepts only scalar values/);
  });

  it('empty-string and null leaves are skipped (operator can clear a single subject)', () => {
    const valid = validateLevelTestScoreDetail('ISEE', {
      verbal: { scaled: 850, percentile: '', stanine: null },
    });
    expect(valid).toEqual({ verbal: { scaled: 850 } });
  });
});
