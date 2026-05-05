import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ACM_DS } from '../../acm-common/datasource';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';

export interface ImportRow {
  rowIndex: number;
  name: string;
  englishName?: string;
  gender?: string;
  birthDate?: string;
  school?: string;
  grade?: string;
  teacher?: string;
  curriculum?: string;
  specialNote?: string;
  goalsNote?: string;
  gpa?: string;
  ssatIseeNote?: string;
  mapNote?: string;
  satisfactionNote?: string;
  lastCounselDate?: string;
  startDate?: string;
  mobility?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * TPI Master 엑셀 2번째 시트 컬럼 매핑 (0-indexed):
 * A(0): 등록일, B(1): 번호(skip), C(2): 이름, D(3): 성별,
 * E(4): 이동수단, F(5): GPA, G(6): MAP메모, H(7): SSAT/ISEE,
 * I(8): 담당강사, J(9): 교재, K(10): 상담내용, L(11): 목표,
 * M(12): 만족도, N(13): 최근상담일
 */
const COLUMN_MAP: Record<number, keyof ImportRow> = {
  0: 'startDate',      // A: 등록일
  // 1: 번호 (skip)
  2: 'name',           // C: 학생 이름
  3: 'gender',         // D: 성별
  4: 'mobility',       // E: 이동수단
  5: 'gpa',            // F: GPA
  6: 'mapNote',        // G: MAP 메모
  7: 'ssatIseeNote',   // H: SSAT/ISEE
  8: 'teacher',        // I: 담당강사
  9: 'curriculum',     // J: 수업교재
  10: 'specialNote',   // K: 상담내용
  11: 'goalsNote',     // L: 목표
  12: 'satisfactionNote', // M: 만족도
  13: 'lastCounselDate',  // N: 최근 상담일
};

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly repo: Repository<StudentTypeormEntity>,
  ) {}

  async importFromBuffer(entId: string, buffer: Buffer): Promise<ImportResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    // 2번째 시트 (index 1), 없으면 1번째 시트
    const sheetName = workbook.SheetNames[1] ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });

    const errors: ImportResult['errors'] = [];
    let success = 0;
    let failed = 0;

    // 첫 행은 헤더 — skip
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const rowIndex = i + 1; // 1-based for user display

      try {
        const parsed = this.parseRow(row, rowIndex);
        if (!parsed) continue; // 빈 행 skip

        await this.upsertStudent(entId, parsed);
        success++;
      } catch (err) {
        failed++;
        errors.push({
          row: rowIndex,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success, failed, errors };
  }

  private parseRow(row: unknown[], rowIndex: number): ImportRow | null {
    const nameRaw = this.cell(row, 2);
    if (!nameRaw) return null; // 이름 없으면 빈 행으로 처리

    const { name, englishName } = this.parseName(nameRaw);

    const parsed: ImportRow = { rowIndex, name };
    if (englishName) parsed.englishName = englishName;

    for (const [col, field] of Object.entries(COLUMN_MAP) as Array<[string, keyof ImportRow]>) {
      const colIndex = Number(col);
      if (colIndex === 2) continue; // name already handled
      const val = this.cell(row, colIndex);
      if (val) {
        (parsed as unknown as Record<string, string>)[field] = val;
      }
    }

    // 성별 정규화: 남→M, 여→F
    if (parsed.gender) {
      if (parsed.gender.includes('남') || parsed.gender.toUpperCase() === 'M') {
        parsed.gender = 'M';
      } else if (parsed.gender.includes('여') || parsed.gender.toUpperCase() === 'F') {
        parsed.gender = 'F';
      } else {
        delete parsed.gender;
      }
    }

    return parsed;
  }

  /** "홍길동(James)" → { name: '홍길동', englishName: 'James' } */
  private parseName(raw: string): { name: string; englishName?: string } {
    const match = /^([^(（]+)[（(]([^)）]+)[)）]/.exec(raw.trim());
    if (match) {
      return { name: match[1].trim(), englishName: match[2].trim() };
    }
    return { name: raw.trim() };
  }

  private cell(row: unknown[], col: number): string | undefined {
    const v = row[col];
    if (v == null || v === '') return undefined;
    return String(v).trim() || undefined;
  }

  private async upsertStudent(entId: string, parsed: ImportRow): Promise<void> {
    if (!parsed.name) throw new Error('이름(std_name) 필드가 누락됐습니다');

    // Upsert 기준: 동일 entId + name (+ birthDate if available)
    let existing: StudentTypeormEntity | null = null;

    if (parsed.birthDate) {
      existing = await this.repo.findOne({
        where: { entId, name: parsed.name, birthDate: parsed.birthDate },
      });
    } else {
      existing = await this.repo.findOne({
        where: { entId, name: parsed.name },
      });
    }

    if (existing) {
      // Update
      this.applyParsed(existing, parsed);
      existing.updatedAt = new Date();
      await this.repo.save(existing);
    } else {
      // Insert
      const entity = this.repo.create({ entId, name: parsed.name, status: 'ACTIVE' });
      this.applyParsed(entity, parsed);
      await this.repo.save(entity);
    }
  }

  private applyParsed(entity: StudentTypeormEntity, parsed: ImportRow): void {
    if (parsed.englishName !== undefined) entity.englishName = parsed.englishName;
    if (parsed.gender === 'M' || parsed.gender === 'F') entity.gender = parsed.gender;
    if (parsed.birthDate !== undefined) entity.birthDate = parsed.birthDate;
    if (parsed.school !== undefined) entity.school = parsed.school;
    if (parsed.grade !== undefined) entity.grade = parsed.grade;
    if (parsed.teacher !== undefined) entity.teacher = parsed.teacher;
    if (parsed.curriculum !== undefined) entity.curriculum = parsed.curriculum;
    if (parsed.specialNote !== undefined) entity.specialNote = parsed.specialNote;
    if (parsed.goalsNote !== undefined) entity.goalsNote = parsed.goalsNote;
    if (parsed.gpa !== undefined) entity.gpa = parsed.gpa;
    if (parsed.ssatIseeNote !== undefined) entity.ssatIseeNote = parsed.ssatIseeNote;
    if (parsed.mapNote !== undefined) entity.mapNote = parsed.mapNote;
    if (parsed.satisfactionNote !== undefined) entity.satisfactionNote = parsed.satisfactionNote;
    if (parsed.lastCounselDate !== undefined) entity.lastCounselDate = parsed.lastCounselDate;
    if (parsed.startDate !== undefined) entity.startDate = parsed.startDate;
    if (parsed.mobility !== undefined) entity.mobility = parsed.mobility;
  }

  /** TPI 형식 빈 템플릿 xlsx 생성 */
  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const headers = [
      '등록일', '번호', '학생 이름', '성별', '이동수단',
      'GPA', 'MAP', 'SSAT/ISEE', '담당강사', '수업교재',
      '상담내용', '목표', '만족도', '최근 상담일',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, '학생명단');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
