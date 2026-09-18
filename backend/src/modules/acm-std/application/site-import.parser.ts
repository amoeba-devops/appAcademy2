import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
export const SITE_SHEETS = {
  'TPI 현재 등록 학생': 'TPI',
  'Trinity Academy 현재 등록 학생': 'TRINITY',
  'Santa Croce 현재 등록 학생': 'SANTACROCE',
} as const;
export interface ParsedStudent {
  key: string;
  sheet: string;
  row: number;
  name: string;
  site: 'TPI' | 'TRINITY' | 'SANTACROCE';
  values: Record<string, string>;
  raw: Record<string, string>;
  warnings: string[];
  errors: string[];
  teacherNames: string[];
}
export function parseDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  const m =
    /^(\d{4})(\d{2})(\d{2})$/.exec(s) ??
    /^(\d{4})[./-](\d{2})[./-](\d{2})$/.exec(s);
  if (!m) return undefined;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(date);
  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === date &&
    +m[1] >= 1900 &&
    +m[1] <= 2100
    ? date
    : undefined;
}
export function parseSiteWorkbook(buffer: Buffer): ParsedStudent[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    throw new BadRequestException('INVALID_WORKBOOK');
  }
  const names = Object.keys(SITE_SHEETS).filter((s) => wb.Sheets[s]);
  if (!names.length)
    throw new BadRequestException('UNSUPPORTED_WORKBOOK_USE_SITE_TEMPLATE');
  const output: ParsedStudent[] = [];
  for (const sheetName of names) {
    const sheet = wb.Sheets[sheetName];
    const cell = (r: number, c: number): unknown =>
      sheet[XLSX.utils.encode_cell({ r, c })]?.v;
    const text = (r: number, c: number) => {
      const v = cell(r, c);
      return v == null
        ? ''
        : v instanceof Date
          ? v.toISOString().slice(0, 10)
          : String(v).trim();
    };
    const headers = [
      '이름',
      '수업시작일',
      '성별',
      '연락처',
      '생년월일',
      '학교',
      '학년',
      '거주지',
      '메일',
      'MAP',
      '담당강사',
      '커리큘럼',
      '수업교재',
      '수업스케줄',
      '특이사항',
    ];
    const header = Array.from({ length: 10 }, (_, r) => r).find((r) =>
      headers.every((h, c) => text(r, c).replace(/\s/g, '').startsWith(h)),
    );
    if (header === undefined)
      throw new BadRequestException('UNSUPPORTED_HEADERS');
    const end = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1').e.r;
    if (end > 10000) throw new BadRequestException('WORKBOOK_TOO_LARGE');
    const anchors = Array.from(
      { length: Math.max(0, end - header) },
      (_, i) => i + header + 1,
    ).filter((r) => text(r, 0));
    for (const r of anchors) {
      const merge = sheet['!merges']?.find(
        (m) => m.s.c === 0 && m.e.c === 0 && m.s.r === r,
      );
      const last = merge?.e.r ?? r;
      const row: ParsedStudent = {
        key: `${sheetName}:${r + 1}`,
        sheet: sheetName,
        row: r + 1,
        name: text(r, 0),
        site: SITE_SHEETS[sheetName as keyof typeof SITE_SHEETS],
        values: {},
        raw: {},
        warnings: [],
        errors: [],
        teacherNames: [],
      };
      for (let c = 0; c < 15; c++) {
        const values: string[] = [];
        for (let line = r; line <= last; line++) {
          const span = sheet['!merges']?.find(
            (m) => m.s.c <= c && m.e.c >= c && m.s.r <= line && m.e.r >= line,
          );
          const shared =
            span &&
            anchors.filter((a) => a >= span.s.r && a <= span.e.r).length > 1;
          if (shared) {
            const range = XLSX.utils.encode_range(span);
            row.warnings.push(`SHARED_CELL:${range}`);
            row.raw[`shared:${range}`] = text(span.s.r, span.s.c);
            continue;
          }
          const value = text(span?.s.r ?? line, span?.s.c ?? c);
          if (value && !values.includes(value)) values.push(value);
        }
        row.raw[XLSX.utils.encode_col(c)] = values.join('\n');
      }
      const map: Record<string, string> = {
        A: 'name',
        F: 'school',
        G: 'grade',
        H: 'residence',
        J: 'mapNote',
        L: 'curriculum',
        M: 'materials',
        O: 'specialNote',
      };
      for (const [col, field] of Object.entries(map))
        if (row.raw[col]) row.values[field] = row.raw[col];
      for (const [col, field] of [
        ['B', 'startDate'],
        ['E', 'birthDate'],
      ]) {
        const raw = row.raw[col];
        if (raw) {
          const d = parseDate(raw);
          if (d) row.values[field] = d;
          else row.errors.push(`INVALID_DATE:${col}${r + 1}`);
        }
      }
      if (row.raw.C) {
        const gender = (
          { 남: 'M', 남자: 'M', 여: 'F', 여자: 'F', M: 'M', F: 'F' } as Record<
            string,
            string
          >
        )[row.raw.C];
        if (gender) row.values.gender = gender;
        else row.warnings.push('GENDER_REVIEW');
      }
      if (row.raw.D || row.raw.I) row.warnings.push('CONTACT_REVIEW');
      if (row.raw.N) row.values.scheduleText = row.raw.N;
      row.teacherNames = [
        ...new Set(
          (row.raw.K || '')
            .split(/[,/\n]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      for (const [field, max] of Object.entries({
        name: 100,
        school: 100,
        grade: 20,
        residence: 100,
      }))
        if ((row.values[field]?.length ?? 0) > max)
          row.errors.push(`TOO_LONG:${field}`);
      output.push(row);
    }
  }
  if (!output.length || output.length > 1000)
    throw new BadRequestException('INVALID_STUDENT_COUNT');
  return output;
}
