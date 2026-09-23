import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { MarketingInputPanel } from './marketing-input-panel';

/** PLN-260914B — manual input scope: tenant-level (COMMON) or one site. */
export type ManualInputSite = 'COMMON' | 'TPI' | 'TRINITY' | 'SANTACROCE';
const SITES: ManualInputSite[] = ['COMMON', 'TPI', 'TRINITY', 'SANTACROCE'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial date (ISO YYYY-MM-DD). Defaults to today. */
  initialDate?: string;
  /** PLN-260914B — preselect a site (from the site tab). Defaults to COMMON. */
  initialSite?: Exclude<ManualInputSite, 'COMMON'>;
  /** Query key suffix to invalidate after save (e.g. range "from~to" or yearMonth). */
  invalidateKey?: string;
}

type NumKey =
  | 'marketingVisitor'
  | 'marketingCost'
  | 'marketingEffect'
  | 'csCounseling'
  | 'csApply'
  | 'csBeginning'
  | 'csMissing'
  | 'csTrialClass'
  | 'csComplain'
  | 'opsNewSt'
  | 'opsOutSt'
  | 'opsCountSt'
  | 'opsNewTc'
  | 'opsOutTc'
  | 'opsCountTc'
  | 'classMapTest'
  | 'classTtClass'
  | 'classStudent'
  | 'classTeacher';

type FormInput = {
  date: string;
  site: ManualInputSite;
  note?: string;
} & Partial<Record<NumKey, number | ''>>;

interface DailyKpiRow {
  date: string;
  marketingVisitor: number | null;
  marketingCost: string | null;
  marketingEffect: number | null;
  csCounseling: number;
  csApply: number;
  csBeginning: number;
  csMissing: number;
  csTrialClass: number;
  csComplain: number;
  opsNewSt: number;
  opsOutSt: number;
  opsCountSt: number;
  opsNewTc: number;
  opsOutTc: number;
  opsCountTc: number;
  classMapTest: number;
  classTtClass: string;
  classStudent: number;
  classTeacher: number;
}

interface ManualInputRow {
  marketingVisitor: number | null;
  marketingCost: string | null;
  csComplain: number | null;
  note: string | null;
}

const SECTIONS: Array<{ key: 'marketing' | 'cs' | 'operating' | 'class'; fields: NumKey[] }> = [
  { key: 'marketing', fields: ['marketingVisitor', 'marketingCost', 'marketingEffect'] },
  {
    key: 'cs',
    fields: ['csCounseling', 'csApply', 'csBeginning', 'csMissing', 'csTrialClass', 'csComplain'],
  },
  {
    key: 'operating',
    fields: ['opsNewSt', 'opsOutSt', 'opsCountSt', 'opsNewTc', 'opsOutTc', 'opsCountTc'],
  },
  { key: 'class', fields: ['classMapTest', 'classTtClass', 'classStudent', 'classTeacher'] },
];

/** Site rows only carry the manually-entered marketing fields + complaints. */
const SITE_SECTIONS: typeof SECTIONS = [
  { key: 'marketing', fields: ['marketingVisitor', 'marketingCost'] },
  { key: 'cs', fields: ['csComplain'] },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNum(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

export function ManualInputDialog({
  open,
  onOpenChange,
  initialDate,
  initialSite,
  invalidateKey,
}: Props) {
  const { t } = useTranslation('dsh');
  const qc = useQueryClient();
  const [marketingDirty, setMarketingDirty] = useState(false);
  const close = () => { if ((marketingDirty || hasOtherEdits) && !window.confirm(t('marketingEditor.discard'))) return; onOpenChange(false); };
  const defaults = (): FormInput => ({
    date: initialDate ?? todayIso(),
    site: initialSite ?? 'COMMON',
  });
  const { register, handleSubmit, reset, setValue, control, getFieldState, formState: { dirtyFields } } = useForm<FormInput>({
    defaultValues: defaults(),
  });

  const hasOtherEdits = Object.keys(dirtyFields).some(k => k !== 'date' && k !== 'site' && !k.startsWith('marketing'));

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate, initialSite]);

  const date = useWatch({ control, name: 'date' });
  const site = useWatch({ control, name: 'site' });
  const isSiteRow = site !== 'COMMON';
  useEffect(() => { reset({date,site}); }, [date,site,reset]);
  const csCounseling = useWatch({ control, name: 'csCounseling' });
  const csApply = useWatch({ control, name: 'csApply' });

  const autoEffect = useMemo(() => {
    return (toNum(csCounseling) ?? 0) + (toNum(csApply) ?? 0);
  }, [csCounseling, csApply]);

  // Keep marketingEffect mirrored to derived value (read-only display).
  useEffect(() => {
    setValue('marketingEffect', autoEffect);
  }, [autoEffect, setValue]);

  const prefill = (name: keyof FormInput, value: FormInput[keyof FormInput]) => { if (!getFieldState(name).isDirty) setValue(name, value); };

  // COMMON: prefill from the tenant daily_kpi row (full override semantics)
  const existingQ = useQuery({
    enabled: open && !!date && !isSiteRow,
    queryKey: ['dsh', 'daily-kpi-row', date],
    queryFn: async () => {
        const res = await apiClient.get<{ rows: DailyKpiRow[] }>('/acm/dsh/daily-kpi-range', {
          params: { from: date, to: date },
        });
        return res.data.rows[0] ?? null;
    },
  });

  // Site row: prefill from the site's manual_inputs row
  const siteRowQ = useQuery({
    enabled: open && !!date && isSiteRow,
    queryKey: ['dsh', 'manual-input-row', date, site],
    queryFn: async () => {
        const res = await apiClient.get<ManualInputRow | null>(
          `/acm/dsh/manual-inputs/${date}`,
          { params: { site } },
        );
        return res.data ?? null;
    },
  });

  useEffect(() => {
    if (!open || isSiteRow) return;
    const r = existingQ.data;
    if (!r) return;
    prefill('marketingVisitor', r.marketingVisitor ?? undefined);
    prefill(
      'marketingCost',
      r.marketingCost !== null && r.marketingCost !== undefined ? Number(r.marketingCost) : undefined,
    );
    prefill('csCounseling', r.csCounseling);
    prefill('csApply', r.csApply);
    prefill('csBeginning', r.csBeginning);
    prefill('csMissing', r.csMissing);
    prefill('csTrialClass', r.csTrialClass);
    prefill('csComplain', r.csComplain);
    prefill('classMapTest', r.classMapTest);
    prefill('classTtClass', Number(r.classTtClass) || 0);
    prefill('classStudent', r.classStudent);
    prefill('classTeacher', r.classTeacher);
  }, [existingQ.data, open, isSiteRow, setValue]);

  useEffect(() => {
    if (!open || !isSiteRow) return;
    const r = siteRowQ.data;
    prefill('marketingVisitor', r?.marketingVisitor ?? undefined);
    prefill(
      'marketingCost',
      r?.marketingCost !== null && r?.marketingCost !== undefined ? Number(r.marketingCost) : undefined,
    );
    prefill('csComplain', r?.csComplain ?? undefined);
    prefill('note', r?.note ?? undefined);
  }, [siteRowQ.data, open, isSiteRow, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: FormInput) => {
      const { date: d, site: s, marketingEffect: _ignored, ...rest } = data;
      if (s !== 'COMMON') {
        // PLN-260914B — per-site manual row (visitor / cost / complain only)
        const body: Record<string, unknown> = { site: s, status: 'COMPLETE' };
        const cc = toNum(rest.csComplain);


        if (dirtyFields.csComplain && cc !== undefined) body.csComplain = cc;
        if (dirtyFields.note && typeof rest.note === 'string' && rest.note.trim() !== '') body.note = rest.note.trim();
        return apiClient.put(`/acm/dsh/manual-inputs/${d}`, body);
      }
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if(k.startsWith('ops') || k.startsWith('marketing') || !dirtyFields[k as keyof FormInput]) continue;
        const num = toNum(v);
        if (num !== undefined) body[k] = num;
        else if (k === 'note' && typeof v === 'string' && v.trim() !== '') body[k] = v.trim();
      }
      return apiClient.put(`/acm/dsh/daily-kpi-manual/${d}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dsh'] });
      if (invalidateKey) qc.invalidateQueries({ queryKey: ['dsh', 'grid', invalidateKey] });
      reset(defaults());
      if (!marketingDirty) onOpenChange(false);
    },
  });

  const sections = (isSiteRow ? SITE_SECTIONS : SECTIONS).filter(s => s.key !== 'operating' && s.key !== 'marketing');

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(); else onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto p-0">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <DialogHeader className="p-4 pb-2 sticky top-0 bg-surface z-10 border-b border-[var(--border-subtle)]">
            <DialogTitle>{t('manualInput.title')}</DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="max-w-xs">
                <Label>{t('manualInput.date')}</Label>
                <Input type="date" required value={date} disabled={marketingDirty} onChange={e => { if (hasOtherEdits && !window.confirm(t('marketingEditor.discard'))) return; setValue('date', e.target.value); }} />
              </div>
              <div>
                <Label>{t('manualInput.site')}</Label>
                <div className="flex flex-wrap gap-3 mt-2" role="radiogroup">
                  {SITES.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm">
                      <input type="radio" value={s} checked={site === s} onChange={() => { if (hasOtherEdits && !window.confirm(t('marketingEditor.discard'))) return; setValue('site', s); }} />
                      {t(`site.tabs.${s}`)}
                    </label>
                  ))}
                </div>
                {isSiteRow && (
                  <p className="text-[11px] text-secondary mt-1">{t('manualInput.siteHint')}</p>
                )}
              </div>
            </div>

            {open && date && <MarketingInputPanel key={date} date={date} site={site} onDirtyChange={setMarketingDirty} />}

            {sections.map((sec) => (
              <fieldset
                key={sec.key}
                className="border border-[var(--border-subtle)] rounded p-3"
              >
                <legend className="px-1 text-sm font-medium">
                  {t(`manualInput.sections.${sec.key}`)}
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sec.fields.map((f) => {
                    const isAutoEffect = f === 'marketingEffect';
                    return (
                      <div key={f}>
                        <Label className="text-xs">{t(`manualInput.fields.${f}`)}</Label>
                        {isAutoEffect ? (
                          <Input
                            type="number"
                            value={autoEffect}
                            readOnly
                            className="bg-surface-subtle cursor-not-allowed"
                          />
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={f === 'classTtClass' ? '0.5' : '1'}
                            {...register(f, { valueAsNumber: true })}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {sec.key === 'marketing' && !isSiteRow && (
                  <p className="text-[11px] text-secondary mt-2">
                    {t('manualInput.effectAutoNote')}
                  </p>
                )}
              </fieldset>
            ))}

            {(existingQ.isError || siteRowQ.isError || mutation.isError) && <p role="alert">{t("marketingEditor.failed")}</p>}
            <div>
              <Label>{t('manualInput.fields.note')}</Label>
              <Input {...register('note')} />
            </div>
          </div>

          <div className="sticky bottom-0 bg-surface border-t border-[var(--border-subtle)] p-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={marketingDirty || mutation.isPending || existingQ.isError || siteRowQ.isError || !(Object.keys(dirtyFields).some(k => k !== "date" && k !== "site" && !k.startsWith("marketing")))}>
              {t('marketingEditor.saveOther')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
