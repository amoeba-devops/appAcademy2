import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { ACM_DS } from '../../acm-common/datasource';
import { MapPassageTypeormEntity } from '../infrastructure/typeorm/map-passage.typeorm-entity';
import { MapQuestionTypeormEntity } from '../infrastructure/typeorm/map-question.typeorm-entity';
import type { MpqImportResult } from './dto/mpq.dto';

const DEFAULT_SOURCE = 'MAP_RC_G2-4_PAST';
const DEFAULT_GRADE = 'G3';

const TEMPLATE_HEADER = [
  'question_no',
  'passage_1',
  'passage_2',
  'glossary',
  'question',
  'choice_1',
  'choice_2',
  'choice_3',
  'choice_4',
  'answer', // 1..4 or blank
  'grade',  // optional G2/G3/G4 (default G3)
];

interface ParsedRow {
  rowIndex: number;
  questionNo: number;
  grade: string;
  passage1: string;
  passage2: string | null;
  glossary: string | null;
  question: string;
  choices: [string, string, string, string];
  answerIndex: number | null;
}

@Injectable()
export class MpqImportService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  generateTemplate(): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADER]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'questions');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return buf;
  }

  async importFromBuffer(entId: string, buffer: Buffer, source = DEFAULT_SOURCE): Promise<MpqImportResult> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });

    const errors: MpqImportResult['errors'] = [];
    let inserted = 0;
    let updated = 0;
    let total = 0;

    return await this.ds.transaction(async (mgr) => {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const rowIndex = i + 1;
        if (!row || row.every((c) => c == null || `${c}`.trim() === '')) continue;
        try {
          const parsed = this.parseRow(row, rowIndex);
          if (!parsed) continue;
          total++;
          const result = await this.upsert(mgr, entId, parsed, source);
          if (result === 'inserted') inserted++;
          else updated++;
        } catch (err) {
          errors.push({ row: rowIndex, message: err instanceof Error ? err.message : String(err) });
        }
      }
      return { inserted, updated, errors, total };
    });
  }

  private parseRow(row: unknown[], rowIndex: number): ParsedRow | null {
    const rawNo = row[0];
    if (rawNo == null || `${rawNo}`.trim() === '') return null;
    const questionNo = Number(rawNo);
    if (!Number.isInteger(questionNo) || questionNo <= 0) {
      throw new Error(`question_no가 유효한 정수가 아닙니다: ${rawNo}`);
    }
    const passage1 = String(row[1] ?? '').trim();
    if (!passage1) throw new Error('passage_1이 비어있습니다');
    const passage2Raw = row[2];
    const passage2 = passage2Raw == null || `${passage2Raw}`.trim() === '' ? null : String(passage2Raw);
    const glossaryRaw = row[3];
    const glossary = glossaryRaw == null || `${glossaryRaw}`.trim() === '' ? null : String(glossaryRaw);
    const question = String(row[4] ?? '').trim();
    if (!question) throw new Error('question이 비어있습니다');
    const c1 = String(row[5] ?? '').trim();
    const c2 = String(row[6] ?? '').trim();
    const c3 = String(row[7] ?? '').trim();
    const c4 = String(row[8] ?? '').trim();
    if (!c1 || !c2 || !c3 || !c4) throw new Error('choice_1~4 모두 입력되어야 합니다');
    let answerIndex: number | null = null;
    const ansRaw = row[9];
    if (ansRaw != null && `${ansRaw}`.trim() !== '') {
      const n = Number(ansRaw);
      if (!Number.isInteger(n) || n < 1 || n > 4) {
        throw new Error(`answer는 1~4 사이여야 합니다: ${ansRaw}`);
      }
      answerIndex = n - 1;
    }
    const gradeRaw = row[10];
    const grade = gradeRaw && `${gradeRaw}`.trim() ? String(gradeRaw).trim() : DEFAULT_GRADE;
    if (!['G2', 'G3', 'G4'].includes(grade)) {
      throw new Error(`grade는 G2/G3/G4 중 하나여야 합니다: ${gradeRaw}`);
    }
    return {
      rowIndex,
      questionNo,
      grade,
      passage1,
      passage2,
      glossary,
      question,
      choices: [c1, c2, c3, c4],
      answerIndex,
    };
  }

  private async upsert(
    mgr: import('typeorm').EntityManager,
    entId: string,
    p: ParsedRow,
    source: string,
  ): Promise<'inserted' | 'updated'> {
    const passageRepo = mgr.getRepository(MapPassageTypeormEntity);
    const questionRepo = mgr.getRepository(MapQuestionTypeormEntity);

    const existing = await questionRepo.findOne({
      where: { entId, grade: p.grade, externalNo: p.questionNo, source },
      relations: { passage: true },
    });

    if (existing) {
      // Update primary passage
      const primary = await passageRepo.findOne({ where: { id: existing.passageId, entId } });
      if (primary) {
        primary.body = p.passage1;
        primary.glossary = p.glossary;
        if (p.passage2) {
          if (!primary.pairGroupId) primary.pairGroupId = primary.id;
          const sibling = await passageRepo.findOne({
            where: { entId, pairGroupId: primary.pairGroupId, ordinal: 2 },
          });
          if (sibling) {
            sibling.body = p.passage2;
            sibling.grade = p.grade;
            await passageRepo.save(sibling);
          } else {
            await passageRepo.save(
              passageRepo.create({
                entId,
                grade: p.grade,
                domain: 'RC',
                body: p.passage2,
                ordinal: 2,
                pairGroupId: primary.pairGroupId,
                source,
                status: 'PUBLISHED',
                version: 1,
              }),
            );
          }
        } else if (primary.pairGroupId) {
          await passageRepo.delete({ entId, pairGroupId: primary.pairGroupId, ordinal: 2 });
          primary.pairGroupId = null;
        }
        primary.grade = p.grade;
        primary.version += 1;
        await passageRepo.save(primary);
      }

      existing.question = p.question;
      existing.choices = p.choices;
      existing.answerIndex = p.answerIndex;
      existing.status = p.answerIndex == null ? 'DRAFT' : 'PUBLISHED';
      existing.version += 1;
      await questionRepo.save(existing);
      return 'updated';
    }

    // Insert
    const primary = await passageRepo.save(
      passageRepo.create({
        entId,
        grade: p.grade,
        domain: 'RC',
        body: p.passage1,
        glossary: p.glossary,
        ordinal: 1,
        source,
        status: 'PUBLISHED',
        version: 1,
      }),
    );
    if (p.passage2) {
      primary.pairGroupId = primary.id;
      await passageRepo.save(primary);
      await passageRepo.save(
        passageRepo.create({
          entId,
          grade: p.grade,
          domain: 'RC',
          body: p.passage2,
          ordinal: 2,
          pairGroupId: primary.id,
          source,
          status: 'PUBLISHED',
          version: 1,
        }),
      );
    }
    await questionRepo.save(
      questionRepo.create({
        entId,
        passageId: primary.id,
        grade: p.grade,
        domain: 'RC',
        externalNo: p.questionNo,
        question: p.question,
        choices: p.choices,
        answerIndex: p.answerIndex,
        explanation: null,
        difficulty: 'INTERMEDIATE',
        source,
        version: 1,
        status: p.answerIndex == null ? 'DRAFT' : 'PUBLISHED',
      }),
    );
    return 'inserted';
  }
}
