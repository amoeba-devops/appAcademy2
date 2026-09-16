import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MAP_APPLY_SITES,
  useImportMapApply,
  type MapApplyImportResult,
  type MapApplyImportRow,
  type MapApplySite,
} from '@/modules/csl/hooks/use-map-applications';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 아임웹 "내보내기" CSV 헤더 → 내부 필드. 라벨 일부만 일치해도 매칭한다. */
const COLUMN_HINTS: Array<{ key: keyof MapApplyImportRow; hints: string[] }> = [
  { key: 'submittedAt', hints: ['작성시각', '작성일', '등록일', 'created'] },
  { key: 'studentName', hints: ['한글 이름', '한글이름', '학생의 한글'] },
  { key: 'studentNameEn', hints: ['영문 이름', '영문이름', '학생의 영문'] },
  { key: 'birthdate', hints: ['생년월일'] },
  { key: 'grade', hints: ['학년'] },
  { key: 'gender', hints: ['성별'] },
  { key: 'parentPhone', hints: ['전화번호', '연락처'] },
  { key: 'parentEmail', hints: ['이메일'] },
  { key: 'examLocation', hints: ['국가', '도시'] },
  { key: 'preferredSlot', hints: ['희망', '요일'] },
];

/** 아주 단순한 CSV 파서 — 따옴표 감싸기와 escaped quote 만 지원. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function mapRows(rows: string[][]): {
  parsed: MapApplyImportRow[];
  unmatched: string[];
} {
  if (!rows.length) return { parsed: [], unmatched: [] };
  const header = rows[0].map((h) => h.trim());
  const idx: Partial<Record<keyof MapApplyImportRow, number>> = {};
  header.forEach((h, i) => {
    for (const { key, hints } of COLUMN_HINTS) {
      if (idx[key] !== undefined) continue;
      if (hints.some((x) => h.includes(x))) {
        idx[key] = i;
        return;
      }
    }
  });
  const unmatched = (['submittedAt', 'studentName'] as const).filter(
    (k) => idx[k] === undefined,
  );
  const get = (r: string[], k: keyof MapApplyImportRow): string | undefined => {
    const i = idx[k];
    if (i === undefined) return undefined;
    const v = (r[i] ?? '').trim();
    return v || undefined;
  };
  const parsed: MapApplyImportRow[] = [];
  for (const r of rows.slice(1)) {
    const submittedAt = get(r, 'submittedAt');
    const studentName = get(r, 'studentName');
    if (!submittedAt || !studentName) continue;
    const genderRaw = get(r, 'gender');
    parsed.push({
      submittedAt,
      studentName,
      studentNameEn: get(r, 'studentNameEn'),
      birthdate: get(r, 'birthdate'),
      grade: get(r, 'grade')?.slice(0, 10),
      gender:
        genderRaw === '남' ? 'M' : genderRaw === '여' ? 'F' : undefined,
      parentPhone: get(r, 'parentPhone'),
      parentEmail: get(r, 'parentEmail'),
      examLocation: get(r, 'examLocation'),
      preferredSlot: get(r, 'preferredSlot'),
    });
  }
  return { parsed, unmatched };
}

/** CSL-PLN-260916 §8 — 아임웹 누적 접수 CSV 이관 모달. */
export function MapApplyImportModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation(['csl', 'common']);
  const [site, setSite] = useState<MapApplySite>('TPI');
  const [rows, setRows] = useState<MapApplyImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<MapApplyImportResult | null>(null);
  const importMut = useImportMapApply();

  const reset = () => {
    setRows([]);
    setFileName('');
    setParseError(null);
    setResult(null);
  };

  const onFile = async (file: File | null) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    try {
      const { parsed, unmatched } = mapRows(parseCsv(await file.text()));
      if (unmatched.length) {
        setParseError(t('mapApply.import.missingColumns'));
        return;
      }
      if (!parsed.length) {
        setParseError(t('mapApply.import.noRows'));
        return;
      }
      setRows(parsed);
    } catch {
      setParseError(t('mapApply.import.parseFailed'));
    }
  };

  const run = async (dryRun: boolean) => {
    try {
      setResult(await importMut.mutateAsync({ site, rows, dryRun }));
    } catch {
      setParseError(t('mapApply.import.failed'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('mapApply.import.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-secondary">{t('mapApply.import.hint')}</p>

          <div>
            <Label className="text-xs">{t('mapApply.field.site')}</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              value={site}
              onChange={(e) => setSite(e.target.value as MapApplySite)}
            >
              {MAP_APPLY_SITES.map((s) => (
                <option key={s} value={s}>
                  {t(`sourceSite.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">{t('mapApply.import.file')}</Label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-1 block w-full text-sm"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            {fileName && (
              <p className="mt-1 text-xs text-secondary">
                {t('mapApply.import.parsed', {
                  name: fileName,
                  count: rows.length,
                })}
              </p>
            )}
            {parseError && (
              <p className="mt-1 text-xs text-red-600">❌ {parseError}</p>
            )}
          </div>

          {result && (
            <div className="rounded-md bg-[var(--canvas-subtle)] px-3 py-2 text-xs">
              <div>
                {result.dryRun
                  ? t('mapApply.import.dryResult', {
                      inserted: result.inserted,
                      skipped: result.skipped,
                      failed: result.failed,
                    })
                  : t('mapApply.import.result', {
                      inserted: result.inserted,
                      skipped: result.skipped,
                      failed: result.failed,
                    })}
              </div>
              {result.errors.slice(0, 5).map((e) => (
                <div key={e.index} className="mt-0.5 text-red-600">
                  #{e.index + 1}: {e.reason}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="outline"
            disabled={!rows.length || importMut.isPending}
            onClick={() => void run(true)}
          >
            {t('mapApply.import.dryRun')}
          </Button>
          <Button
            disabled={!rows.length || importMut.isPending}
            onClick={() => void run(false)}
          >
            {importMut.isPending && (
              <Loader2 size={14} className="mr-1 animate-spin" />
            )}
            {t('mapApply.import.run')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
