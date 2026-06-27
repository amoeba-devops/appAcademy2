import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import {
  LevelTestType,
  MapTestTypeormEntity,
} from '../infrastructure/typeorm/map-test.typeorm-entity';

/**
 * REQ-260626 T-13 / FR-CSL-116 / DSN §5.7 — server-side rendering of the
 * level-test result PDF.
 *
 * Layout (DSN §5.7):
 *   header   — academy name (placeholder), student basic info row,
 *              test type + scheduled date + entered_by
 *   body     — full per-type score table from §5.6 ("-" for null leaves
 *              so blank rows don't disappear)
 *   footer   — generated_at + confidential note
 *
 * Returns a `Buffer` so the controller can `res.send` with a stable
 * Content-Disposition. No file I/O, no temp files.
 *
 * Notes
 *   - pdfkit ships its own Helvetica family — Korean characters render as
 *     boxes until we install a CJK font. Keeping Latin-only labels in the
 *     PDF for the v1 (FR-CSL-116 wording is "강사 공유 PDF", but the
 *     rendered content is the test scores which are numeric).
 *   - Score detail JSONB shape is governed by DSN §5.6 / the
 *     level-test-score validator. We tolerate missing keys.
 */
@Injectable()
export class LevelTestPdfService {
  private readonly log = new Logger(LevelTestPdfService.name);

  constructor(
    @InjectRepository(InquiryTypeormEntity, ACM_DS)
    private readonly inqRepo: Repository<InquiryTypeormEntity>,
    @InjectRepository(MapTestTypeormEntity, ACM_DS)
    private readonly mtRepo: Repository<MapTestTypeormEntity>,
    private readonly crypto: AesGcmService,
  ) {}

  async generate(
    entId: string,
    inqId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const inq = await this.inqRepo.findOne({ where: { entId, id: inqId } });
    if (!inq) throw new NotFoundException({ code: 'INQUIRY_NOT_FOUND', inqId });

    const mt = await this.mtRepo.findOne({ where: { entId, inqId } });
    if (!mt) {
      throw new NotFoundException({
        code: 'LEVEL_TEST_ROW_NOT_FOUND',
        inqId,
        hint: 'Schedule the level test and record the result before downloading the PDF',
      });
    }

    const decryptedName = this.crypto.decrypt({
      ciphertext: inq.nameEncrypted,
      iv: inq.nameIv,
      authTag: inq.nameAuthTag,
    });
    // Display in the PDF header uses '-' so a missing field is visibly
    // empty rather than the literal placeholder; filename falls back to
    // the constant 'student' so file-system tools don't choke on a row
    // of dashes.
    const studentName = decryptedName ?? '-';
    const filenameSlug = decryptedName?.replace(/[^\w가-힣\-]/g, '').slice(0, 30);

    const buffer = await renderPdfBuffer((doc) => {
      // ── Header ────────────────────────────────────────────────────────
      doc.fontSize(18).text('Level Test Result', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#666').text(
        '(Teacher-shared report — confidential)',
        { align: 'center' },
      );
      doc.moveDown(0.8);
      doc.fillColor('#000');

      // ── Student row ───────────────────────────────────────────────────
      doc.fontSize(11);
      const grade = inq.grade ?? '-';
      const school = inq.schoolFreetext ?? '-';
      const seqNo = inq.seqNo ?? '-';
      doc.text(`Student: ${studentName}    Grade: ${grade}    School: ${school}`);
      doc.text(`Inquiry #${seqNo}`);
      doc.moveDown(0.3);

      // ── Test row ──────────────────────────────────────────────────────
      const testLabel = formatTestType(mt.testType, mt.testTypeOther);
      const scheduled = mt.scheduledAt
        ? `${mt.scheduledAt}${mt.scheduledTime ? ` ${mt.scheduledTime.slice(0, 5)}` : ''}`
        : '-';
      const enteredAt = mt.resultEnteredAt
        ? new Date(mt.resultEnteredAt).toISOString().slice(0, 16).replace('T', ' ')
        : '-';
      doc.text(`Test: ${testLabel}    Scheduled: ${scheduled}    Entered at: ${enteredAt}`);
      doc.moveDown(0.8);

      drawHr(doc);
      doc.moveDown(0.4);

      // ── Score table ───────────────────────────────────────────────────
      doc.fontSize(13).text('Scores', { underline: false });
      doc.moveDown(0.3);
      doc.fontSize(10);

      const rows = scoreRows(mt);
      drawTable(doc, rows.header, rows.body);

      // ── Footer ────────────────────────────────────────────────────────
      doc.moveDown(1.5);
      drawHr(doc);
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#777');
      doc.text(
        `Generated at ${new Date().toISOString().slice(0, 19).replace('T', ' ')} (UTC)`,
        { align: 'left' },
      );
      doc.text('For internal academy use only.', { align: 'left' });
    });

    const filename = `LevelTest_${filenameSlug || 'student'}_${mt.testType}_${inqId.slice(0, 8)}.pdf`;
    this.log.log(
      `generated PDF inq=${inqId} std=${studentName} type=${mt.testType} bytes=${buffer.length}`,
    );
    return { buffer, filename };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

type Doc = InstanceType<typeof PDFDocument>;

function renderPdfBuffer(render: (doc: Doc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      render(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function drawHr(doc: Doc): void {
  const y = doc.y;
  doc.strokeColor('#ccc').lineWidth(0.5);
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
  doc.strokeColor('#000');
}

function drawTable(doc: Doc, header: string[], body: string[][]): void {
  const startX = 50;
  const cellPad = 6;
  const cols = header.length;
  const totalWidth = doc.page.width - startX * 2;
  const colWidth = totalWidth / cols;

  function row(cells: string[], opts: { bold?: boolean } = {}): void {
    const rowY = doc.y;
    const height = 18;
    cells.forEach((text, i) => {
      const x = startX + colWidth * i;
      doc.rect(x, rowY, colWidth, height).strokeColor('#bbb').stroke();
      doc.fontSize(opts.bold ? 10 : 9).fillColor('#000');
      doc.text(text || '-', x + cellPad, rowY + 4, {
        width: colWidth - cellPad * 2,
        height: height - 4,
        ellipsis: true,
      });
    });
    doc.y = rowY + height;
  }

  row(header, { bold: true });
  body.forEach((r) => row(r));
}

function formatTestType(type: LevelTestType, other: string | null | undefined): string {
  if (type === 'OTHER') return other ? `Other (${other})` : 'Other';
  if (type === 'TOEFL_JR') return 'TOEFL Jr';
  return type;
}

/**
 * DSN §5.7 — header + body for the test-type-specific score table.
 * Missing leaves rendered as "-" so the row count stays predictable
 * (FR-CSL-116 says "all indicators must be shown").
 */
function scoreRows(mt: MapTestTypeormEntity): { header: string[]; body: string[][] } {
  const t = mt.testType;
  if (t === 'MAP') {
    return {
      header: ['Section', 'Score'],
      body: [
        ['Reading', formatNum(mt.scoreReading)],
        ['Language Usage', formatNum(mt.scoreLanguage)],
        ['Math', formatNum(mt.scoreMath)],
      ],
    };
  }
  const detail = (mt.scoreDetail ?? {}) as Record<string, Record<string, number | undefined> | number | undefined>;
  switch (t) {
    case 'ISEE':
      return {
        header: ['Section', 'Scaled', 'Percentile', 'Stanine'],
        body: ['verbal', 'reading', 'quantitative', 'mathematics'].map((k) => {
          const row = (detail[k] as Record<string, number | undefined>) ?? {};
          return [
            capitalize(k),
            formatNum(row.scaled),
            formatNum(row.percentile),
            formatNum(row.stanine),
          ];
        }),
      };
    case 'SSAT':
      return {
        header: ['Section', 'Score', 'Percentile'],
        body: [
          ...['verbal', 'quantitative', 'reading'].map((k) => {
            const row = (detail[k] as Record<string, number | undefined>) ?? {};
            return [capitalize(k), formatNum(row.score), formatNum(row.percentile)];
          }),
          (() => {
            const total = (detail.total as Record<string, number | undefined>) ?? {};
            return ['Total', formatNum(total.score), formatNum(total.percentile)];
          })(),
        ],
      };
    case 'DUOLINGO': {
      const keys = [
        'total', 'speaking', 'writing', 'reading', 'listening',
        'production', 'literacy', 'comprehension', 'conversation',
      ];
      return {
        header: ['Item', 'Score'],
        body: keys.map((k) => [capitalize(k), formatNum(detail[k] as number | undefined)]),
      };
    }
    case 'TOEFL':
      return {
        header: ['Section', 'Score (1~6)'],
        body: ['total', 'speaking', 'writing', 'reading', 'listening'].map((k) => [
          capitalize(k),
          formatNum(detail[k] as number | undefined),
        ]),
      };
    case 'TOEFL_JR':
      return {
        header: ['Section', 'Score'],
        body: [
          ['Total (0~5)', formatNum(detail.total as number | undefined)],
          ['Listening', formatNum(detail.listening as number | undefined)],
          ['LFM', formatNum(detail.lfm as number | undefined)],
          ['Reading', formatNum(detail.reading as number | undefined)],
        ],
      };
    case 'OTHER':
      return {
        header: ['Key', 'Value'],
        body: Object.entries(detail).map(([k, v]) => [k, String(v ?? '-')]),
      };
  }
}

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return String(n);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
