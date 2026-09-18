import * as XLSX from 'xlsx';
import { parseDate, parseSiteWorkbook } from './site-import.parser';
const headers = [
  '이름',
  '수업 시작일',
  '성별',
  '연락처',
  '생년월일',
  '학교',
  '학년',
  '거주지',
  '메일',
  'MAP TEST',
  '담당 강사',
  '커리큘럼',
  '수업교재',
  '수업 스케줄',
  '특이사항',
];
function workbook(rows: unknown[][], merges: XLSX.Range[] = []) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, ws, 'TPI 현재 등록 학생');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
describe('site workbook parser', () => {
  it('groups only merged name continuation rows and preserves grade notation', () => {
    const rows = parseSiteWorkbook(
      workbook(
        [
          [
            'Student A',
            '',
            '여',
            '',
            20120304,
            'School',
            'Rising 8',
            '',
            '',
            '',
            'Teacher A',
          ],
          ['', '', '', '', '', '', '', '', '', '', 'Teacher B'],
          ['Student B'],
        ],
        [{ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }],
      ),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].values).toMatchObject({
      birthDate: '2012-03-04',
      grade: 'Rising 8',
      gender: 'F',
    });
    expect(rows[0].teacherNames).toEqual(['Teacher A', 'Teacher B']);
  });
  it('does not copy a shared note into two students', () => {
    const rows = parseSiteWorkbook(
      workbook(
        [
          [
            'Student A',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'shared',
          ],
          ['Student B'],
        ],
        [{ s: { r: 1, c: 14 }, e: { r: 2, c: 14 } }],
      ),
    );
    expect(rows.every((r) => !r.values.specialNote)).toBe(true);
    expect(rows[1].raw['shared:O2:O3']).toBe('shared');
  });
  it('does not infer portal credentials from contact cells', () => {
    const row = parseSiteWorkbook(
      workbook([
        [
          'Student A',
          '',
          '',
          'messenger id',
          '',
          '',
          '',
          '',
          'parent@example.test',
        ],
      ]),
    )[0];
    expect(row.warnings).toContain('CONTACT_REVIEW');
    expect(row.values.email).toBeUndefined();
    expect(row.raw.I).toBe('parent@example.test');
  });
  it('rejects unknown workbook formats instead of guessing a sheet', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['name'], ['Student A']]),
      'Unknown',
    );
    expect(() =>
      parseSiteWorkbook(
        Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })),
      ),
    ).toThrow('UNSUPPORTED_WORKBOOK');
  });
  it('keeps malformed dates out of the write set', () => {
    const row = parseSiteWorkbook(workbook([['Student A', '202412/14']]))[0];
    expect(row.errors).toContain('INVALID_DATE:B2');
    expect(row.values.startDate).toBeUndefined();
  });
  it('validates calendar dates and preserves names with parentheses', () => {
    expect(parseDate('20260230')).toBeUndefined();
    expect(parseDate('20240229')).toBe('2024-02-29');
    expect(
      parseSiteWorkbook(workbook([['Student (Alias)']]))[0].values.name,
    ).toBe('Student (Alias)');
  });
});
