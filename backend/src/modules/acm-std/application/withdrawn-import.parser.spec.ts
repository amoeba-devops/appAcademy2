import * as XLSX from 'xlsx';
import {
  normalizeWithdrawnFields,
  parseWithdrawnWorkbook,
  WITHDRAWN_HEADERS,
} from './withdrawn-import.parser';
const source = () => ({
  이름: '가상학생',
  성별: '남',
  원생고유번호: '00001',
  입학일: '20260101',
  퇴원일: '20260901',
  재원여부: 'X',
  휴원여부: 'X',
  할인액: 0,
  적립금: 0,
  할인구분: '원',
});
function workbook(rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      WITHDRAWN_HEADERS.map((h) => (h === '등록일' ? h + '  ' : h)),
      ...rows.map((r) => WITHDRAWN_HEADERS.map((h) => r[h] ?? '')),
    ]),
    'Sheet0',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
describe('withdrawn roster parser', () => {
  it('retains 48 columns, leading zero IDs, false flags and zero amounts', () => {
    const result = parseWithdrawnWorkbook(workbook([source()]));
    expect(result).toHaveLength(1);
    expect(result[0].errors).toEqual([]);
    expect(Object.keys(result[0].fields)).toHaveLength(48);
    expect(result[0].fields).toMatchObject({
      원생고유번호: '00001',
      퇴원일: '2026-09-01',
      생일: null,
      재원여부: false,
      할인액: 0,
    });
  });
  it('rejects invalid dates, duplicate identifiers and live enrollment flags', () => {
    const result = parseWithdrawnWorkbook(
      workbook([source(), { ...source(), 생일: '20260230', 재원여부: 'O' }]),
    );
    expect(result[1].errors).toEqual(
      expect.arrayContaining([
        'INVALID_DATE:생일',
        'NOT_WITHDRAWN',
        'DUPLICATE_EXTERNAL_ID',
      ]),
    );
  });
  it('rejects unknown fields and invalid billing values', () => {
    expect(
      normalizeWithdrawnFields({
        ...source(),
        수납기준청구일: 0,
        hidden: 'instruction',
      }).errors,
    ).toEqual(expect.arrayContaining(['UNKNOWN_FIELD', 'INVALID_BILLING_DAY']));
  });
  it('retains identity independently of row order', () => {
    const a = source(),
      b = { ...source(), 이름: '별도학생', 원생고유번호: '00002' };
    expect(parseWithdrawnWorkbook(workbook([b, a]))[1].key).toBe(
      parseWithdrawnWorkbook(workbook([a, b]))[0].key,
    );
  });
});
