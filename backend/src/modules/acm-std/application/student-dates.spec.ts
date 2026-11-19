import { unifyAdmissionStart } from './student-dates';

describe('REQ-261119B unifyAdmissionStart', () => {
  it('둘 다 있으면 빠른 날', () => {
    expect(unifyAdmissionStart({ admissionDate: '2026-11-16', startDate: '2026-11-03' })).toEqual({
      admissionDate: '2026-11-03',
      startDate: '2026-11-03',
    });
  });
  it('한쪽만 있으면 그 값', () => {
    expect(unifyAdmissionStart({ admissionDate: null, startDate: '2026-11-16' }).admissionDate).toBe('2026-11-16');
    expect(unifyAdmissionStart({ admissionDate: '2026-10-01', startDate: undefined }).startDate).toBe('2026-10-01');
  });
  it('이번 요청이 한쪽만 바꾸면 그 값으로 (늦은 날로 정정 가능)', () => {
    expect(
      unifyAdmissionStart({ admissionDate: '2026-12-01', startDate: '2026-11-03' }, { admission: true }),
    ).toEqual({ admissionDate: '2026-12-01', startDate: '2026-12-01' });
    expect(
      unifyAdmissionStart({ admissionDate: '2026-11-03', startDate: null }, { start: true }),
    ).toEqual({ admissionDate: null, startDate: null });
  });
  it('둘 다 없으면 그대로 비움', () => {
    expect(unifyAdmissionStart({})).toEqual({ admissionDate: null, startDate: null });
  });
});
