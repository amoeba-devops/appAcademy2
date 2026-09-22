import {
  applyWithdrawnDateDefaults,
  type WithdrawnDateFields,
} from './withdrawn-dates';

describe('applyWithdrawnDateDefaults (RPT-260922D B)', () => {
  it('fills end date from withdrawn date and start date from admission date', () => {
    const s = applyWithdrawnDateDefaults(<WithdrawnDateFields>{
      status: 'WITHDRAWN',
      admissionDate: '2026-03-02',
      withdrawnDate: '2026-03-06',
    });
    expect(s.startDate).toBe('2026-03-02');
    expect(s.endDate).toBe('2026-03-06');
  });

  it('never overwrites existing class dates', () => {
    const s = applyWithdrawnDateDefaults(<WithdrawnDateFields>{
      status: 'WITHDRAWN',
      startDate: '2025-11-28',
      endDate: '2026-01-31',
      admissionDate: '2025-11-01',
      withdrawnDate: '2026-02-02',
    });
    expect(s.startDate).toBe('2025-11-28');
    expect(s.endDate).toBe('2026-01-31');
  });

  it('leaves non-withdrawn students untouched', () => {
    const s = applyWithdrawnDateDefaults(<WithdrawnDateFields>{
      status: 'ACTIVE',
      admissionDate: '2026-03-02',
      withdrawnDate: '2026-03-06',
    });
    expect(s.startDate).toBeUndefined();
    expect(s.endDate).toBeUndefined();
  });

  it('does nothing when the source dates are missing', () => {
    const s = applyWithdrawnDateDefaults(<WithdrawnDateFields>{
      status: 'WITHDRAWN',
    });
    expect(s.startDate).toBeUndefined();
    expect(s.endDate).toBeUndefined();
  });
});
