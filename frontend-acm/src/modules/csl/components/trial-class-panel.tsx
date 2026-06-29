import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AttachmentPanel } from './attachment-panel';

/**
 * REQ-260626 SCR-CSL-03 — demo class panel.
 *
 * Re-skin of the legacy "Trial class" panel for the relabel: each row is
 * an editable demo session with schedule (date + 30-min time), assigned
 * teacher, completion flag, and the 3-step feedback workflow
 * (TEACHER writes → STAFF confirms → STAFF marks delivered after the
 * manual KakaoTalk copy).
 *
 * Backend: P2C (PR #62) — updateTrialClass / writeFeedback /
 * confirmFeedback / markFeedbackDelivered. The role gates live on the
 * server, so this panel keeps the buttons enabled and surfaces 403/400
 * inline; the visual hint comes from the user's role exposed via JWT.
 *
 * Material upload (FR-CSL-126) and CAL event registration (FR-CSL-122
 * +CAL link) are deferred to T-06 / T-08 respectively.
 */
interface TrialClass {
  id: string;
  heldAt: string;
  heldTime: string | null;
  teacherId: string | null;
  completed: boolean;
  note: string | null;
  feedbackBody: string | null;
  feedbackAuthoredBy: string | null;
  feedbackAuthoredAt: string | null;
  feedbackConfirmedBy: string | null;
  feedbackConfirmedAt: string | null;
  feedbackDeliveredAt: string | null;
  calEventId: string | null;
}

interface Teacher {
  id: string;
  name: string;
}

/** 30-min increment options 09:00 ~ 22:30 — covers full schedule. */
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 9; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
})();

export function TrialClassPanel({ inqId }: { inqId: string }) {
  const { t, i18n } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [heldAt, setHeldAt] = useState('');
  const [heldTime, setHeldTime] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const { data: classes = [] } = useQuery({
    queryKey: ['csl', 'trial-classes', inqId],
    queryFn: async () => {
      const res = await apiClient.get<TrialClass[]>(
        `/acm/csl/inquiries/${inqId}/trial-classes`,
      );
      return res.data;
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
    // /acm/tch/teachers returns `{ items, total, page, limit }` (no `meta`,
    // so the global TransformInterceptor doesn't unwrap items). Handle
    // both shapes so a future shape change doesn't break the picker.
    queryFn: async () => {
      try {
        const res = await apiClient.get<Teacher[] | { items: Teacher[] }>(
          '/acm/tch/teachers',
        );
        const body = res.data;
        return Array.isArray(body) ? body : (body?.items ?? []);
      } catch {
        return [];
      }
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/acm/csl/inquiries/${inqId}/trial-classes`, {
        heldAt,
        heldTime: heldTime || undefined,
        teacherId: teacherId || undefined,
      });
    },
    onSuccess: () => {
      setHeldAt('');
      setHeldTime('');
      setTeacherId('');
      qc.invalidateQueries({ queryKey: ['csl', 'trial-classes', inqId] });
    },
  });

  const dateLocale =
    ({ ko: 'ko-KR', en: 'en-US', vi: 'vi-VN', 'zh-CN': 'zh-CN' } as Record<string, string>)[
      i18n.language ?? 'ko'
    ] ?? 'ko-KR';

  const nameById = new Map(teachers.map((tt) => [tt.id, tt.name]));

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{t('detail.trial.title')}</h2>

      {/* List of demo sessions */}
      <div className="grid gap-3 mb-4">
        {classes.length === 0 && (
          <p className="text-xs text-secondary">{t('detail.trial.empty')}</p>
        )}
        {classes.map((c) => (
          <DemoClassRow
            key={c.id}
            inqId={inqId}
            tcl={c}
            teachers={teachers}
            teacherName={c.teacherId ? nameById.get(c.teacherId) ?? null : null}
            dateLocale={dateLocale}
            onChange={() =>
              qc.invalidateQueries({ queryKey: ['csl', 'trial-classes', inqId] })
            }
          />
        ))}
      </div>

      {/* Add new demo session */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <h3 className="text-xs font-semibold text-secondary mb-2">
          {t('detail.trial.addNew')}
        </h3>
        <div className="grid grid-cols-[1fr_140px_1fr_auto] gap-2 items-end">
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.trial.heldAt')}</Label>
            <Input type="date" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.trial.heldTime')}</Label>
            <Select value={heldTime} onChange={(e) => setHeldTime(e.target.value)}>
              <option value="">—</option>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.trial.teacher')}</Label>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">—</option>
              {teachers.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!heldAt || create.isPending}>
            {t('detail.trial.add')}
          </Button>
        </div>
        {create.isError && (
          <p className="mt-2 text-xs text-red-600">
            {(create.error as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? (create.error as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}

// ── Single demo session row ───────────────────────────────────────────

function DemoClassRow({
  inqId,
  tcl,
  teachers,
  teacherName,
  dateLocale,
  onChange,
}: {
  inqId: string;
  tcl: TrialClass;
  teachers: Teacher[];
  teacherName: string | null;
  dateLocale: string;
  onChange: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const [feedbackDraft, setFeedbackDraft] = useState(tcl.feedbackBody ?? '');
  const [editingTime, setEditingTime] = useState(tcl.heldTime ?? '');
  const [editingTeacher, setEditingTeacher] = useState(tcl.teacherId ?? '');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await apiClient.patch(
        `/acm/csl/inquiries/${inqId}/trial-classes/${tcl.id}`,
        body,
      );
    },
    onSuccess: onChange,
  });

  const writeFb = useMutation({
    mutationFn: async () => {
      await apiClient.patch(
        `/acm/csl/inquiries/${inqId}/trial-classes/${tcl.id}/feedback`,
        { body: feedbackDraft },
      );
    },
    onSuccess: onChange,
  });

  const confirmFb = useMutation({
    mutationFn: async () => {
      await apiClient.post(
        `/acm/csl/inquiries/${inqId}/trial-classes/${tcl.id}/feedback/confirm`,
      );
    },
    onSuccess: onChange,
  });

  const deliveredFb = useMutation({
    mutationFn: async () => {
      await apiClient.post(
        `/acm/csl/inquiries/${inqId}/trial-classes/${tcl.id}/feedback/delivered`,
      );
    },
    onSuccess: onChange,
  });

  function copyForKakao() {
    if (!tcl.feedbackBody) return;
    navigator.clipboard.writeText(tcl.feedbackBody).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  }

  const heldDate = new Date(tcl.heldAt).toLocaleDateString(dateLocale);

  return (
    <article className="rounded-md border border-[var(--border-subtle)] p-3 text-sm">
      {/* Header: date + teacher + completed */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="font-medium">
          {heldDate}
          {tcl.heldTime && (
            <span className="ml-1 text-secondary">{tcl.heldTime.slice(0, 5)}</span>
          )}
        </span>
        <span className="text-secondary">
          {teacherName ?? (tcl.teacherId ? tcl.teacherId.slice(0, 8) : t('detail.trial.noTeacher'))}
        </span>
        <label className="flex items-center gap-1 text-xs ml-auto">
          <input
            type="checkbox"
            checked={tcl.completed}
            onChange={(e) => patch.mutate({ completed: e.target.checked })}
          />
          {t('detail.trial.completed')}
        </label>
      </div>

      {/* Edit row — time + teacher (date is fixed at creation; CAL link deferred) */}
      <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-end mb-3">
        <div className="grid gap-1">
          <Label className="text-xs">{t('detail.trial.heldTime')}</Label>
          <Select value={editingTime} onChange={(e) => setEditingTime(e.target.value)}>
            <option value="">—</option>
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t('detail.trial.teacher')}</Label>
          <Select
            value={editingTeacher}
            onChange={(e) => setEditingTeacher(e.target.value)}
          >
            <option value="">—</option>
            {teachers.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            patch.mutate({
              heldTime: editingTime || undefined,
              teacherId: editingTeacher || undefined,
            })
          }
          disabled={patch.isPending}
        >
          {t('common:actions.save')}
        </Button>
      </div>

      {/* Feedback workflow */}
      <div className="grid gap-2 rounded-md bg-[var(--surface-strong)] p-3">
        <Label className="text-xs">{t('detail.trial.feedbackBody')}</Label>
        <textarea
          value={feedbackDraft}
          onChange={(e) => setFeedbackDraft(e.target.value)}
          rows={3}
          className="min-h-[72px] w-full rounded-md border border-[var(--border-subtle)] bg-transparent p-2 text-sm"
          placeholder={t('detail.trial.feedbackPlaceholder')}
        />
        <FeedbackTimeline tcl={tcl} dateLocale={dateLocale} />

        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => writeFb.mutate()}
            disabled={!feedbackDraft.trim() || writeFb.isPending}
          >
            {tcl.feedbackBody
              ? t('detail.trial.updateFeedback')
              : t('detail.trial.writeFeedback')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => confirmFb.mutate()}
            disabled={!tcl.feedbackBody || !!tcl.feedbackConfirmedAt || confirmFb.isPending}
          >
            {t('detail.trial.confirmFeedback')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={copyForKakao}
            disabled={!tcl.feedbackBody}
          >
            {copyStatus === 'copied'
              ? t('detail.trial.copied')
              : t('detail.trial.copyForKakao')}
          </Button>
          <Button
            type="button"
            onClick={() => deliveredFb.mutate()}
            disabled={!tcl.feedbackConfirmedAt || !!tcl.feedbackDeliveredAt || deliveredFb.isPending}
          >
            {t('detail.trial.markDelivered')}
          </Button>
        </div>

        {(writeFb.isError || confirmFb.isError || deliveredFb.isError) && (
          <p className="text-xs text-red-600">
            {(
              (writeFb.error ?? confirmFb.error ?? deliveredFb.error) as {
                response?: { data?: { message?: string } };
              }
            )?.response?.data?.message ??
              ((writeFb.error ?? confirmFb.error ?? deliveredFb.error) as Error).message}
          </p>
        )}
      </div>

      {/* T-06 / ADR-008 — class material attachments scoped to this row */}
      <div className="mt-3">
        <AttachmentPanel inqId={inqId} category="MATERIAL" refId={tcl.id} />
      </div>
    </article>
  );
}

function FeedbackTimeline({
  tcl,
  dateLocale,
}: {
  tcl: TrialClass;
  dateLocale: string;
}) {
  const { t } = useTranslation(['csl', 'common']);
  function fmt(ts: string | null): string {
    return ts ? new Date(ts).toLocaleString(dateLocale) : '—';
  }
  return (
    <ul className="grid gap-0.5 text-[11px] text-secondary">
      <li>
        ✍ {t('detail.trial.authoredAt')}:{' '}
        <span className={tcl.feedbackAuthoredAt ? 'text-primary' : ''}>
          {fmt(tcl.feedbackAuthoredAt)}
        </span>
      </li>
      <li>
        ✅ {t('detail.trial.confirmedAt')}:{' '}
        <span className={tcl.feedbackConfirmedAt ? 'text-primary' : ''}>
          {fmt(tcl.feedbackConfirmedAt)}
        </span>
      </li>
      <li>
        📨 {t('detail.trial.deliveredAt')}:{' '}
        <span className={tcl.feedbackDeliveredAt ? 'text-primary' : ''}>
          {fmt(tcl.feedbackDeliveredAt)}
        </span>
      </li>
    </ul>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
    />
  );
}
