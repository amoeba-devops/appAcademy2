import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * REQ-260626 T-15 v2 / DSN §5.6 — per-type structured input for the
 * level-test scoreDetail JSONB. Replaces the JSON textarea v1 so
 * operators don't have to hand-craft objects.
 *
 * Backend validator (level-test-score.validator.ts) is the source of
 * truth — this editor mirrors the same shape and ranges. Server-side
 * still validates, so wrong values surface as 400 (no double rendering
 * of error state).
 */
export type LevelTestType =
  | 'MAP'
  | 'ISEE'
  | 'SSAT'
  | 'DUOLINGO'
  | 'TOEFL'
  | 'TOEFL_JR'
  | 'OTHER';

type Detail = Record<string, unknown>;

interface Props {
  testType: LevelTestType;
  value: Detail | null;
  onChange: (next: Detail) => void;
}

export function LevelTestScoreEditor({ testType, value, onChange }: Props) {
  const v = value ?? {};

  if (testType === 'MAP') {
    // MAP uses dedicated columns on the row; the editor isn't shown.
    return null;
  }

  function setKey(path: string[], next: unknown): void {
    // shallow set with dotted path. operator inputs are flat or 1-level
    // nested (per DSN §5.6) so no deep merge needed.
    const out = { ...v };
    if (path.length === 1) {
      out[path[0]] = next;
    } else {
      const [head, ...rest] = path;
      const child = ((out[head] as Detail | undefined) ?? {}) as Detail;
      const updated: Detail = { ...child };
      let cursor = updated;
      for (let i = 0; i < rest.length - 1; i++) {
        const k = rest[i];
        cursor[k] = { ...((cursor[k] as Detail) ?? {}) };
        cursor = cursor[k] as Detail;
      }
      cursor[rest[rest.length - 1]] = next;
      out[head] = updated;
    }
    onChange(out);
  }

  switch (testType) {
    case 'ISEE':
      return <IseeEditor v={v} setKey={setKey} />;
    case 'SSAT':
      return <SsatEditor v={v} setKey={setKey} />;
    case 'DUOLINGO':
      return <DuolingoEditor v={v} setKey={setKey} />;
    case 'TOEFL':
      return <ToeflEditor v={v} setKey={setKey} />;
    case 'TOEFL_JR':
      return <ToeflJrEditor v={v} setKey={setKey} />;
    case 'OTHER':
      return <OtherEditor v={v} onChange={onChange} />;
  }
}

// ── ISEE: 4 sections × 3 fields ─────────────────────────────────────────

const ISEE_SECTIONS = ['verbal', 'reading', 'quantitative', 'mathematics'] as const;

function IseeEditor({
  v,
  setKey,
}: {
  v: Detail;
  setKey: (path: string[], next: unknown) => void;
}) {
  const { t } = useTranslation(['csl']);
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t('detail.mapTest.isee.label')}</Label>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-secondary">
            <th className="text-left py-1 w-32">Section</th>
            <th className="text-left py-1">Scaled (760~940)</th>
            <th className="text-left py-1">Percentile (1~99)</th>
            <th className="text-left py-1">Stanine (1~9)</th>
          </tr>
        </thead>
        <tbody>
          {ISEE_SECTIONS.map((s) => {
            const row = ((v[s] as Detail | undefined) ?? {}) as Detail;
            return (
              <tr key={s} className="border-t border-[var(--border-subtle)]">
                <td className="py-1.5 capitalize font-medium">{s}</td>
                <td className="py-1">
                  <Input
                    type="number"
                    min={760}
                    max={940}
                    value={numStr(row.scaled)}
                    onChange={(e) =>
                      setKey([s, 'scaled'], emptyOrInt(e.target.value))
                    }
                  />
                </td>
                <td className="py-1">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={numStr(row.percentile)}
                    onChange={(e) =>
                      setKey([s, 'percentile'], emptyOrInt(e.target.value))
                    }
                  />
                </td>
                <td className="py-1">
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    value={numStr(row.stanine)}
                    onChange={(e) =>
                      setKey([s, 'stanine'], emptyOrInt(e.target.value))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── SSAT: 3 sections × {score, percentile} + total ──────────────────────

const SSAT_SECTIONS = ['verbal', 'quantitative', 'reading'] as const;

function SsatEditor({
  v,
  setKey,
}: {
  v: Detail;
  setKey: (path: string[], next: unknown) => void;
}) {
  const { t } = useTranslation(['csl']);
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t('detail.mapTest.ssat.label')}</Label>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-secondary">
            <th className="text-left py-1 w-32">Section</th>
            <th className="text-left py-1">Score (440~710)</th>
            <th className="text-left py-1">Percentile (0~100)</th>
          </tr>
        </thead>
        <tbody>
          {SSAT_SECTIONS.map((s) => {
            const row = ((v[s] as Detail | undefined) ?? {}) as Detail;
            return (
              <tr key={s} className="border-t border-[var(--border-subtle)]">
                <td className="py-1.5 capitalize font-medium">{s}</td>
                <td className="py-1">
                  <Input
                    type="number"
                    min={440}
                    max={710}
                    value={numStr(row.score)}
                    onChange={(e) => setKey([s, 'score'], emptyOrInt(e.target.value))}
                  />
                </td>
                <td className="py-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={numStr(row.percentile)}
                    onChange={(e) => setKey([s, 'percentile'], emptyOrInt(e.target.value))}
                  />
                </td>
              </tr>
            );
          })}
          {/* Total row — different range (1320~2082) */}
          <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-strong)]">
            <td className="py-1.5 font-semibold">Total</td>
            <td className="py-1">
              <Input
                type="number"
                min={1320}
                max={2082}
                value={numStr(((v.total as Detail | undefined) ?? {}).score)}
                onChange={(e) => setKey(['total', 'score'], emptyOrInt(e.target.value))}
              />
            </td>
            <td className="py-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={numStr(((v.total as Detail | undefined) ?? {}).percentile)}
                onChange={(e) => setKey(['total', 'percentile'], emptyOrInt(e.target.value))}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── DUOLINGO: 9 flat keys × 10~160 ─────────────────────────────────────

const DUOLINGO_KEYS = [
  'total', 'speaking', 'writing', 'reading', 'listening',
  'production', 'literacy', 'comprehension', 'conversation',
] as const;

function DuolingoEditor({
  v,
  setKey,
}: {
  v: Detail;
  setKey: (path: string[], next: unknown) => void;
}) {
  const { t } = useTranslation(['csl']);
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t('detail.mapTest.duolingo.label')}</Label>
      <div className="grid grid-cols-3 gap-2">
        {DUOLINGO_KEYS.map((k) => (
          <div key={k} className="grid gap-1">
            <Label className="text-[11px] capitalize">{k} (10~160)</Label>
            <Input
              type="number"
              min={10}
              max={160}
              value={numStr(v[k])}
              onChange={(e) => setKey([k], emptyOrInt(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TOEFL: total + 4 sections × 1~6 by 0.5 ─────────────────────────────

const TOEFL_KEYS = ['total', 'speaking', 'writing', 'reading', 'listening'] as const;

function ToeflEditor({
  v,
  setKey,
}: {
  v: Detail;
  setKey: (path: string[], next: unknown) => void;
}) {
  const { t } = useTranslation(['csl']);
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t('detail.mapTest.toefl.label')}</Label>
      <div className="grid grid-cols-5 gap-2">
        {TOEFL_KEYS.map((k) => (
          <div key={k} className="grid gap-1">
            <Label className="text-[11px] capitalize">{k}</Label>
            <Input
              type="number"
              min={1}
              max={6}
              step={0.5}
              value={numStr(v[k])}
              onChange={(e) => setKey([k], emptyOrFloat(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TOEFL Jr: total 0~5 + sections 200~300 ─────────────────────────────

function ToeflJrEditor({
  v,
  setKey,
}: {
  v: Detail;
  setKey: (path: string[], next: unknown) => void;
}) {
  const { t } = useTranslation(['csl']);
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t('detail.mapTest.toeflJr.label')}</Label>
      <div className="grid grid-cols-4 gap-2">
        <div className="grid gap-1">
          <Label className="text-[11px]">Total (0~5)</Label>
          <Input
            type="number"
            min={0}
            max={5}
            value={numStr(v.total)}
            onChange={(e) => setKey(['total'], emptyOrInt(e.target.value))}
          />
        </div>
        {['listening', 'lfm', 'reading'].map((k) => (
          <div key={k} className="grid gap-1">
            <Label className="text-[11px] uppercase">{k} (200~300)</Label>
            <Input
              type="number"
              min={200}
              max={300}
              value={numStr(v[k])}
              onChange={(e) => setKey([k], emptyOrInt(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OTHER: dynamic key-value rows ──────────────────────────────────────

function OtherEditor({
  v,
  onChange,
}: {
  v: Detail;
  onChange: (next: Detail) => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const entries = Object.entries(v);

  function update(idx: number, field: 'key' | 'value', next: string): void {
    const out = { ...v };
    const [oldKey, oldVal] = entries[idx];
    if (field === 'key') {
      delete out[oldKey];
      out[next] = oldVal;
    } else {
      const num = Number(next);
      out[oldKey] = next === '' ? '' : Number.isFinite(num) && next.trim() !== '' ? num : next;
    }
    onChange(out);
  }

  function add(): void {
    const out = { ...v };
    let key = 'Key';
    let n = 1;
    while (key in out) {
      n += 1;
      key = `Key ${n}`;
    }
    out[key] = '';
    onChange(out);
  }

  function remove(key: string): void {
    const out = { ...v };
    delete out[key];
    onChange(out);
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t('detail.mapTest.other.label')}</Label>
      {entries.length === 0 && (
        <p className="text-[11px] text-secondary">{t('detail.mapTest.other.empty')}</p>
      )}
      {entries.map(([k, val], idx) => (
        <div key={`${k}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            placeholder={t('detail.mapTest.other.keyPlaceholder')}
            value={k}
            onChange={(e) => update(idx, 'key', e.target.value)}
          />
          <Input
            placeholder={t('detail.mapTest.other.valuePlaceholder')}
            value={String(val ?? '')}
            onChange={(e) => update(idx, 'value', e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => remove(k)}
            className="text-red-600"
          >
            {t('common:actions.remove', 'Remove')}
          </Button>
        </div>
      ))}
      <div className="flex justify-start">
        <Button type="button" variant="outline" onClick={add}>
          {t('common:actions.add', 'Add')}
        </Button>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────

function numStr(n: unknown): string {
  if (n === null || n === undefined || n === '') return '';
  return String(n);
}

function emptyOrInt(s: string): number | undefined {
  if (s === '' || s === null || s === undefined) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function emptyOrFloat(s: string): number | undefined {
  if (s === '' || s === null || s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
