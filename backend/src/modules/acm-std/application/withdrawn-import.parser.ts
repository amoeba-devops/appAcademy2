import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { parseDate } from './site-import.parser';

export const WITHDRAWN_HEADERS = [
  '이름',
  '성별',
  '출결번호',
  '학교',
  '학년',
  '반',
  '원생연락처',
  '집전화',
  '보호자연락처',
  '보호자구분',
  '보호자이름',
  '보호자출결알림',
  '기타보호자연락처',
  '기타보호자이름',
  '기타보호자출결알림',
  '현금영수증발급번호',
  '현금영수증발급구분',
  '닉네임',
  '생일',
  '입학일',
  '우편번호',
  '주소1',
  '주소2',
  '입학동기',
  '재원여부',
  '퇴원일',
  '퇴원사유',
  '휴원여부',
  '휴원사유',
  '수납기준청구일',
  '할인액',
  '할인구분',
  '문과/이과',
  '형제',
  '원생고유번호',
  '메모',
  '졸업연도',
  '원생이메일',
  '수업',
  '기타수납',
  '담임강사',
  '원생분류',
  '기타항목1',
  '기타항목2',
  '포인트',
  '적립금',
  '자동결제신청여부',
  '등록일',
] as const;
export type WithdrawnFields = Record<string, string | number | boolean | null>;
export interface WithdrawnRow {
  key: string;
  row: number;
  fields: WithdrawnFields;
  errors: string[];
}
const dates = new Set(['생일', '입학일', '퇴원일']);
const flags = new Set([
  '보호자출결알림',
  '기타보호자출결알림',
  '재원여부',
  '휴원여부',
  '자동결제신청여부',
]);
const numbers = new Set([
  '수납기준청구일',
  '할인액',
  '포인트',
  '적립금',
  '졸업연도',
]);
export function normalizeWithdrawnFields(input: Record<string, unknown>): {
  fields: WithdrawnFields;
  errors: string[];
} {
  const errors: string[] = [];
  const fields: WithdrawnFields = {};
  if (
    Object.keys(input).some(
      (k) => !(WITHDRAWN_HEADERS as readonly string[]).includes(k),
    )
  )
    errors.push('UNKNOWN_FIELD');
  for (const key of WITHDRAWN_HEADERS) {
    const raw = input[key];
    if (raw == null || raw === '') {
      fields[key] = null;
      continue;
    }
    if (!['string', 'number', 'boolean'].includes(typeof raw)) {
      errors.push(`INVALID_VALUE:${key}`);
      continue;
    }
    const text = String(raw).trim();
    if (!text) {
      fields[key] = null;
      continue;
    }
    if (text.length > (key === '메모' ? 10000 : 1000))
      errors.push(`TOO_LONG:${key}`);
    if (dates.has(key)) {
      fields[key] = parseDate(text) ?? null;
      if (!fields[key]) errors.push(`INVALID_DATE:${key}`);
    } else if (flags.has(key)) {
      if (raw === true || ['O', 'Y', '1'].includes(text)) fields[key] = true;
      else if (raw === false || ['X', 'N', '0'].includes(text))
        fields[key] = false;
      else errors.push(`INVALID_FLAG:${key}`);
    } else if (numbers.has(key)) {
      const number = Number(text);
      if (!Number.isFinite(number) || number < 0)
        errors.push(`INVALID_NUMBER:${key}`);
      else fields[key] = number;
    } else fields[key] = text;
  }
  for (const [key, max] of [
    ['원생고유번호', 100],
    ['학교', 100],
    ['학년', 20],
    ['원생연락처', 30],
    ['원생이메일', 200],
  ] as const)
    if (String(fields[key] ?? '').length > max) errors.push(`TOO_LONG:${key}`);
  for (const key of ['이름', '원생고유번호', '입학일', '퇴원일'])
    if (!fields[key]) errors.push(`REQUIRED:${key}`);
  if (String(fields['이름'] ?? '').length > 100) errors.push('NAME_TOO_LONG');
  if (fields['성별'] && !['남', '여'].includes(String(fields['성별'])))
    errors.push('INVALID_GENDER');
  if (
    fields['퇴원일'] &&
    fields['입학일'] &&
    fields['퇴원일'] < fields['입학일']
  )
    errors.push('WITHDRAWAL_BEFORE_ADMISSION');
  if (fields['재원여부'] === true || fields['휴원여부'] === true)
    errors.push('NOT_WITHDRAWN');
  const day = fields['수납기준청구일'];
  if (
    day != null &&
    (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 31)
  )
    errors.push('INVALID_BILLING_DAY');
  if (fields['할인구분'] && !['원', '%'].includes(String(fields['할인구분'])))
    errors.push('INVALID_DISCOUNT_UNIT');
  if (
    fields['원생이메일'] &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields['원생이메일']))
  )
    errors.push('INVALID_EMAIL');
  return { fields, errors };
}
export function parseWithdrawnWorkbook(buffer: Buffer): WithdrawnRow[] {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new BadRequestException('INVALID_WORKBOOK');
  }
  const sheets = book.SheetNames.filter((name) => {
    const sheet = book.Sheets[name];
    return WITHDRAWN_HEADERS.every(
      (header, col) =>
        String(
          sheet[XLSX.utils.encode_cell({ r: 0, c: col })]?.v ?? '',
        ).trim() === header,
    );
  });
  if (sheets.length !== 1)
    throw new BadRequestException('WITHDRAWN_HEADERS_REQUIRED');
  const sheet = book.Sheets[sheets[0]];
  const end = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1').e.r;
  if (end > 1000) throw new BadRequestException('WORKBOOK_TOO_LARGE');
  const rows: WithdrawnRow[] = [];
  const seen = new Set<string>();
  for (let r = 1; r <= end; r++) {
    if (!sheet[`A${r + 1}`]?.v) continue;
    const input: Record<string, unknown> = {};
    WITHDRAWN_HEADERS.forEach((header, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell?.f) throw new BadRequestException('FORMULA_NOT_ALLOWED');
      input[header] = cell?.v ?? null;
    });
    const parsed = normalizeWithdrawnFields(input);
    const key = String(parsed.fields['원생고유번호'] ?? '');
    if (seen.has(key)) parsed.errors.push('DUPLICATE_EXTERNAL_ID');
    seen.add(key);
    rows.push({ key, row: r + 1, ...parsed });
  }
  if (!rows.length) throw new BadRequestException('EMPTY_WORKBOOK');
  return rows;
}
