import { BadRequestException } from '@nestjs/common';
import type { LevelTestType } from './inquiry.dto';

/**
 * REQ-260626 FR-CSL-115 / DSN §5.6 — per-test-type score schema validation.
 *
 * MAP uses the dedicated `score{Reading,Math,Language}` columns on the
 * map_test row and is enforced by DB CHECK (100~350). All other test
 * types serialize into `mpt_score_detail JSONB`; this validator is the
 * only place that knows their shapes, so the controller can stay lean.
 *
 * Each helper returns the validated detail (clone, primitive-coerced)
 * or throws BadRequestException with a precise pointer to the offending
 * field. Empty / undefined fields are allowed (operator partial-save).
 *
 * @see docs/design/DSN-260626-acm-csl-pipeline-revision.md §5.6
 */

type IndexedDetail = Record<string, unknown>;
type LeafValidator = (value: unknown, path: string) => number | undefined;

/** Integer in [min, max] or undefined. */
function int(min: number, max: number): LeafValidator {
  return (value, path) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new BadRequestException(
        `${path}: expected integer in [${min}, ${max}], got ${JSON.stringify(value)}`,
      );
    }
    return n;
  };
}

/** Decimal with 0.5 step in [min, max] or undefined. Used by TOEFL 1~6 by 0.5. */
function halfStep(min: number, max: number): LeafValidator {
  return (value, path) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (n * 2) % 1 !== 0) {
      throw new BadRequestException(
        `${path}: expected 0.5-step number in [${min}, ${max}], got ${JSON.stringify(value)}`,
      );
    }
    return n;
  };
}

/** Pick known keys from input and validate each via the provided spec. */
function validateRecord(
  input: unknown,
  path: string,
  spec: Record<string, LeafValidator>,
): Record<string, number> | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException(`${path}: expected object`);
  }
  const out: Record<string, number> = {};
  for (const [k, validate] of Object.entries(spec)) {
    const v = validate((input as IndexedDetail)[k], `${path}.${k}`);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ── Per-type schemas (DSN §5.6) ─────────────────────────────────────────

function validateIsee(detail: IndexedDetail): IndexedDetail {
  // 4 sections × {scaled 760~940, percentile 1~99, stanine 1~9}
  const section = {
    scaled: int(760, 940),
    percentile: int(1, 99),
    stanine: int(1, 9),
  };
  const out: IndexedDetail = {};
  for (const k of ['verbal', 'reading', 'quantitative', 'mathematics']) {
    const row = validateRecord(detail[k], `scoreDetail.${k}`, section);
    if (row) out[k] = row;
  }
  return out;
}

function validateSsat(detail: IndexedDetail): IndexedDetail {
  // 3 sections × {score 440~710, percentile 0~100} + total {1320~2082, 0~100}
  const section = { score: int(440, 710), percentile: int(0, 100) };
  const total = { score: int(1320, 2082), percentile: int(0, 100) };
  const out: IndexedDetail = {};
  for (const k of ['verbal', 'quantitative', 'reading']) {
    const row = validateRecord(detail[k], `scoreDetail.${k}`, section);
    if (row) out[k] = row;
  }
  const totalRow = validateRecord(detail.total, 'scoreDetail.total', total);
  if (totalRow) out.total = totalRow;
  return out;
}

function validateDuolingo(detail: IndexedDetail): IndexedDetail {
  // total + 4 main + 4 sub, all 10~160
  const v = int(10, 160);
  const keys = [
    'total', 'speaking', 'writing', 'reading', 'listening',
    'production', 'literacy', 'comprehension', 'conversation',
  ];
  const out: IndexedDetail = {};
  for (const k of keys) {
    const r = v(detail[k], `scoreDetail.${k}`);
    if (r !== undefined) out[k] = r;
  }
  return out;
}

function validateToefl(detail: IndexedDetail): IndexedDetail {
  // total + 4 sections, all 1~6 by 0.5
  const v = halfStep(1, 6);
  const keys = ['total', 'speaking', 'writing', 'reading', 'listening'];
  const out: IndexedDetail = {};
  for (const k of keys) {
    const r = v(detail[k], `scoreDetail.${k}`);
    if (r !== undefined) out[k] = r;
  }
  return out;
}

function validateToeflJr(detail: IndexedDetail): IndexedDetail {
  // total 0~5, sections 200~300
  const out: IndexedDetail = {};
  const total = int(0, 5)(detail.total, 'scoreDetail.total');
  if (total !== undefined) out.total = total;
  for (const k of ['listening', 'lfm', 'reading']) {
    const r = int(200, 300)(detail[k], `scoreDetail.${k}`);
    if (r !== undefined) out[k] = r;
  }
  return out;
}

function validateOther(detail: IndexedDetail): IndexedDetail {
  // Free-form. Accept any flat key/value where values are coercible to a number.
  // Reject nested objects to keep PDF rendering predictable.
  const out: IndexedDetail = {};
  for (const [k, raw] of Object.entries(detail)) {
    if (raw === null || raw === undefined || raw === '') continue;
    if (typeof raw === 'object') {
      throw new BadRequestException(`scoreDetail.${k}: OTHER schema accepts only scalar values`);
    }
    const n = Number(raw);
    out[k] = Number.isFinite(n) ? n : String(raw);
  }
  return out;
}

/**
 * Entry point — pick the matching schema and validate. Returns the
 * normalized detail (server should persist this, not the raw DTO input,
 * to ensure consistent JSONB shape).
 *
 * For MAP: detail must be empty / undefined; scores belong on the dedicated
 * columns. Throws if an operator submits both.
 */
export function validateLevelTestScoreDetail(
  testType: LevelTestType,
  detail: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (detail === undefined || detail === null) return null;
  if (Object.keys(detail).length === 0) return null;

  if (testType === 'MAP') {
    throw new BadRequestException(
      'MAP test scores use scoreReading/scoreMath/scoreLanguage; scoreDetail must be empty',
    );
  }
  switch (testType) {
    case 'ISEE':     return validateIsee(detail);
    case 'SSAT':     return validateSsat(detail);
    case 'DUOLINGO': return validateDuolingo(detail);
    case 'TOEFL':    return validateToefl(detail);
    case 'TOEFL_JR': return validateToeflJr(detail);
    case 'OTHER':    return validateOther(detail);
  }
}
