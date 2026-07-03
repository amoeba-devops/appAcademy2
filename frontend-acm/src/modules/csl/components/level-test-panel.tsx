import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilePreviewDialog } from './file-preview-dialog';
import { LevelTestScheduleDialog } from './level-test-schedule-dialog';
import { LevelTestScoreEditor } from './level-test-score-editor';
import type { LevelTestType } from './level-test-score-editor';

/**
 * DSN-260629 §6 — SCR-CSL-02 v2. Stage 2 (레벨테스트) 패널.
 *
 *   - 시험종류별 1 row (백엔드 PR #75 sql/acm/987 uq(inq_id, test_type))
 *   - 행마다: 시험 / 응시예정일·시간 (모달) / 담당강사 / 상태 (inline select)
 *   - COMPLETED 행은 시험별 점수 입력 폼 + per-type PDF 다운로드 노출
 *   - 통합 PDF 버튼 (모든 COMPLETED 행을 1개 파일로)
 *   - 이전점수 보유 여부 (`hasPriorScore`) UI 제거 — 1단계에서 처리
 *
 * 신청 목적 (applyPurposes) 에서 어떤 시험 row 가 노출되는지 결정 (필요 시
 * 운영자가 "행 추가" 로 수동 add). v1 은 inquiry.applyPurposes 매핑 +
 * "행 추가" 수동 select.
 */

interface LevelTest {
  id: string;
  inqId: string;
  testType: LevelTestType;
  testTypeOther: string | null;
  scheduledAt: string | null;
  scheduledTime: string | null;
  teacherId: string | null;
  scheduledStatus: 'PENDING' | 'COMPLETED' | 'NOT_HELD' | null;
  scoreReading: number | null;
  scoreMath: number | null;
  scoreLanguage: number | null;
  scoreDetail: Record<string, unknown> | null;
  resultEnteredAt: string | null;
}

interface Inquiry {
  applyPurposes?: string[];
}

interface Teacher {
  id: string;
  name: string;
}

const LEVEL_TEST_TYPES: LevelTestType[] = [
  'MAP',
  'ISEE',
  'SSAT',
  'DUOLINGO',
  'TOEFL',
  'TOEFL_JR',
  'OTHER',
];

const STATUSES = ['PENDING', 'COMPLETED', 'NOT_HELD'] as const;

export function LevelTestPanel({ inqId }: { inqId: string }) {
  const { t, i18n } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [dialogRow, setDialogRow] = useState<LevelTest | null>(null);
  const [expandedScoreType, setExpandedScoreType] = useState<LevelTestType | null>(
    null,
  );
  const [resultPreviewRow, setResultPreviewRow] = useState<LevelTest | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [newType, setNewType] = useState<LevelTestType>('SSAT');
  const [newTypeOther, setNewTypeOther] = useState('');

  const { data: inq } = useQuery({
    queryKey: ['csl', 'detail', inqId],
    queryFn: async () => {
      const res = await apiClient.get<Inquiry>(`/acm/csl/inquiries/${inqId}`);
      return res.data;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['csl', 'level-tests', inqId],
    queryFn: async () => {
      const res = await apiClient.get<LevelTest[]>(
        `/acm/csl/inquiries/${inqId}/level-tests`,
      );
      return res.data;
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
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
    staleTime: 60_000,
  });
  const teacherName = new Map(teachers.map((tt) => [tt.id, tt.name]));

  // Map of type → row for quick lookup
  const byType = new Map(rows.map((r) => [r.testType, r]));

  /**
   * Determine which test types to show as rows. Priority:
   *   1. Any type with an existing row (already scheduled / scored).
   *   2. Types implied by inquiry.applyPurposes
   *      (MAP_TEST_TUTORING → MAP, ISEE_TUTORING → ISEE).
   *   ADVANCED_COURSES is left to manual "add row" UX since multiple
   *   tests can hide behind it (SSAT/Duolingo/TOEFL/...).
   */
  const purposes = new Set(inq?.applyPurposes ?? []);
  const visibleTypes = new Set<LevelTestType>();
  rows.forEach((r) => visibleTypes.add(r.testType));
  if (purposes.has('MAP_TEST_TUTORING')) visibleTypes.add('MAP');
  if (purposes.has('ISEE_TUTORING')) visibleTypes.add('ISEE');
  const orderedTypes = LEVEL_TEST_TYPES.filter((t) => visibleTypes.has(t));

  const upsertStatus = useMutation({
    mutationFn: async (opts: { type: LevelTestType; status: typeof STATUSES[number] }) => {
      await apiClient.put(`/acm/csl/inquiries/${inqId}/level-tests/${opts.type}`, {
        status: opts.status,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl', 'level-tests', inqId] }),
  });

  const addTestType = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/acm/csl/inquiries/${inqId}/level-tests/${newType}`, {
        ...(newType === 'OTHER'
          ? { testTypeOther: newTypeOther.trim() || undefined }
          : {}),
      });
    },
    onSuccess: () => {
      setNewTypeOther('');
      qc.invalidateQueries({ queryKey: ['csl', 'level-tests', inqId] });
    },
  });

  async function downloadPdf(testType: LevelTestType | 'all'): Promise<void> {
    const path =
      testType === 'all'
        ? `/acm/csl/inquiries/${inqId}/level-tests/result-pdf`
        : `/acm/csl/inquiries/${inqId}/level-tests/${testType}/result-pdf`;
    try {
      const res = await apiClient.get<Blob>(path, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd =
        (res.headers as Record<string, string | undefined> | undefined)?.[
          'content-disposition'
        ] ?? '';
      const match = /filename="?([^";]+)"?/.exec(cd);
      a.download = match
        ? decodeURIComponent(match[1])
        : `level-test-${testType}-${inqId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      window.alert(err.response?.data?.message ?? 'PDF download failed');
    }
  }

  async function previewPdf(testType: LevelTestType): Promise<void> {
    try {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
      const res = await apiClient.get<Blob>(
        `/acm/csl/inquiries/${inqId}/level-tests/${testType}/result-pdf`,
        { responseType: 'blob' },
      );
      const title = `${typeLabel(testType, byType.get(testType)?.testTypeOther ?? null)} PDF`;
      setPdfPreview({
        url: URL.createObjectURL(res.data),
        title,
      });
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      window.alert(err.response?.data?.message ?? 'PDF preview failed');
    }
  }

  const dateLocale =
    ({ ko: 'ko-KR', en: 'en-US', vi: 'vi-VN', 'zh-CN': 'zh-CN' } as Record<string, string>)[
      i18n.language ?? 'ko'
    ] ?? 'ko-KR';

  function fmtSchedule(r: LevelTest): string {
    if (!r.scheduledAt) return '—';
    const date = new Date(r.scheduledAt).toLocaleDateString(dateLocale);
    const time = r.scheduledTime ? ` ${r.scheduledTime.slice(0, 5)}` : '';
    return `${date}${time}`;
  }

  function typeLabel(type: LevelTestType, other: string | null): string {
    if (type === 'OTHER' && other) return `Other (${other})`;
    if (type === 'TOEFL_JR') return 'TOEFL Jr';
    return type;
  }

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5 grid gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('detail.levelTest.title')}</h2>
        <p className="text-[11px] text-secondary mt-1">
          {t('detail.levelTest.skipHint')}
        </p>
      </div>

      {/* Schedule table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-secondary text-xs border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 w-32">{t('detail.levelTest.col.test')}</th>
              <th className="text-left py-2">{t('detail.levelTest.col.schedule')}</th>
              <th className="text-left py-2 w-40">{t('detail.levelTest.col.teacher')}</th>
              <th className="text-left py-2 w-32">{t('detail.levelTest.col.status')}</th>
              <th className="text-right py-2 w-80">{t('detail.levelTest.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {orderedTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-secondary text-xs">
                  {t('detail.levelTest.empty')}
                </td>
              </tr>
            )}
            {orderedTypes.map((type) => {
              const row = byType.get(type) ?? {
                id: '',
                inqId,
                testType: type,
                testTypeOther: null,
                scheduledAt: null,
                scheduledTime: null,
                teacherId: null,
                scheduledStatus: 'PENDING' as const,
                scoreReading: null,
                scoreMath: null,
                scoreLanguage: null,
                scoreDetail: null,
                resultEnteredAt: null,
              };
              const isCompleted = row.scheduledStatus === 'COMPLETED';
              return (
                <tr key={type} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2.5 font-medium">
                    {typeLabel(type, row.testTypeOther)}
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => setDialogRow(row)}
                      className="text-left inline-flex items-center gap-2 hover:text-primary"
                    >
                      📅 {fmtSchedule(row)}
                    </button>
                  </td>
                  <td className="py-2.5">
                    {row.teacherId
                      ? teacherName.get(row.teacherId) ?? row.teacherId.slice(0, 8)
                      : '—'}
                  </td>
                  <td className="py-2.5">
                    <select
                      value={row.scheduledStatus ?? 'PENDING'}
                      onChange={(e) =>
                        upsertStatus.mutate({
                          type,
                          status: e.target.value as typeof STATUSES[number],
                        })
                      }
                      className="h-8 rounded-md border border-[var(--border-subtle)] bg-transparent px-2 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`detail.levelTest.status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setExpandedScoreType(
                            expandedScoreType === type ? null : type,
                          )
                        }
                        disabled={!isCompleted}
                        title={
                          !isCompleted
                            ? t('detail.levelTest.scoreLockedHint')
                            : undefined
                        }
                      >
                        {t('detail.levelTest.scoreToggle')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setResultPreviewRow(row)}
                        disabled={!row.resultEnteredAt}
                        title={
                          !row.resultEnteredAt
                            ? t('detail.levelTest.pdfLockedHint')
                            : undefined
                        }
                      >
                        {t('detail.levelTest.previewResult', {
                          defaultValue: '결과 보기',
                        })}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void previewPdf(type)}
                        disabled={!row.resultEnteredAt}
                        title={
                          !row.resultEnteredAt
                            ? t('detail.levelTest.pdfLockedHint')
                            : undefined
                        }
                      >
                        {t('detail.levelTest.previewPdf', {
                          defaultValue: 'PDF 보기',
                        })}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score editor (expanded per-row) */}
      {expandedScoreType && (
        <ScoreEditorBlock
          inqId={inqId}
          row={byType.get(expandedScoreType) ?? null}
          testType={expandedScoreType}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['csl', 'level-tests', inqId] });
          }}
          onClose={() => setExpandedScoreType(null)}
        />
      )}

      <div className="grid gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold">
              {t('detail.levelTest.addTypeLabel', {
                defaultValue: '시험종류 추가',
              })}
            </Label>
            <p className="text-[11px] text-secondary mt-1">
              {t('detail.levelTest.addTypeHint', {
                defaultValue: '운영자가 시험 row 를 수동으로 추가할 수 있습니다.',
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as LevelTestType)}
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
            >
              {LEVEL_TEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === 'TOEFL_JR' ? 'TOEFL Jr' : type}
                </option>
              ))}
            </select>
            {newType === 'OTHER' && (
              <input
                type="text"
                value={newTypeOther}
                onChange={(e) => setNewTypeOther(e.target.value)}
                placeholder={t('detail.levelTest.otherNamePlaceholder', {
                  defaultValue: '시험명 직접 입력',
                })}
                className="h-9 rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
              />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => addTestType.mutate()}
              disabled={
                addTestType.isPending ||
                !!byType.get(newType) ||
                (newType === 'OTHER' && !newTypeOther.trim())
              }
            >
              {t('common:actions.add', { defaultValue: '추가' })}
            </Button>
          </div>
        </div>
        {!!byType.get(newType) && (
          <p className="text-xs text-amber-700">
            {t('detail.levelTest.duplicateType', {
              defaultValue: '이미 추가된 시험종류입니다.',
            })}
          </p>
        )}
        {addTestType.isError && (
          <p className="text-xs text-red-600">
            {(addTestType.error as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? (addTestType.error as Error).message}
          </p>
        )}
      </div>

      {/* Unified PDF */}
      <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => downloadPdf('all')}
          disabled={!rows.some((r) => r.resultEnteredAt)}
        >
          {t('detail.levelTest.unifiedPdf')}
        </Button>
      </div>

      {/* Schedule dialog */}
      {dialogRow && (
        <LevelTestScheduleDialog
          open={!!dialogRow}
          onOpenChange={(next) => !next && setDialogRow(null)}
          inqId={inqId}
          row={{
            testType: dialogRow.testType,
            testTypeOther: dialogRow.testTypeOther,
            scheduledAt: dialogRow.scheduledAt,
            scheduledTime: dialogRow.scheduledTime,
            teacherId: dialogRow.teacherId,
          }}
        />
      )}
      <ResultPreviewDialog
        open={!!resultPreviewRow}
        onOpenChange={(next) => !next && setResultPreviewRow(null)}
        row={resultPreviewRow}
      />
      <FilePreviewDialog
        open={!!pdfPreview}
        onOpenChange={(next) => {
          if (!next && pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
          if (!next) setPdfPreview(null);
        }}
        title={pdfPreview?.title ?? 'PDF Preview'}
        src={pdfPreview?.url ?? null}
        mime="application/pdf"
      />
    </section>
  );
}

// ── Score editor block ─────────────────────────────────────────────────

function ScoreEditorBlock({
  inqId,
  row,
  testType,
  onSaved,
  onClose,
}: {
  inqId: string;
  row: LevelTest | null;
  testType: LevelTestType;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const [scoreReading, setScoreReading] = useState<string>(
    row?.scoreReading?.toString() ?? '',
  );
  const [scoreMath, setScoreMath] = useState<string>(row?.scoreMath?.toString() ?? '');
  const [scoreLanguage, setScoreLanguage] = useState<string>(
    row?.scoreLanguage?.toString() ?? '',
  );
  const [scoreDetail, setScoreDetail] = useState<Record<string, unknown> | null>(
    row?.scoreDetail ?? null,
  );

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { testType };
      if (testType === 'MAP') {
        if (scoreReading) body.scoreReading = Number(scoreReading);
        if (scoreMath) body.scoreMath = Number(scoreMath);
        if (scoreLanguage) body.scoreLanguage = Number(scoreLanguage);
      } else if (scoreDetail && Object.keys(scoreDetail).length > 0) {
        body.scoreDetail = scoreDetail;
      }
      await apiClient.post(
        `/acm/csl/inquiries/${inqId}/level-tests/${testType}/result`,
        body,
      );
    },
    onSuccess: () => {
      onSaved();
    },
  });

  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3 grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          {t('detail.levelTest.scoreEditorHeader', {
            test:
              testType === 'TOEFL_JR'
                ? 'TOEFL Jr'
                : testType === 'OTHER'
                  ? 'Other'
                  : testType,
          })}
        </Label>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-secondary hover:text-primary"
        >
          ✕
        </button>
      </div>

      {testType === 'MAP' ? (
        <div className="grid grid-cols-3 gap-3">
          {/* English-fixed labels per FR-CSL-102 */}
          <Field label="Reading">
            <input
              type="number"
              min={100}
              max={350}
              placeholder="100~350"
              value={scoreReading}
              onChange={(e) => setScoreReading(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
            />
          </Field>
          <Field label="Math">
            <input
              type="number"
              min={100}
              max={350}
              placeholder="100~350"
              value={scoreMath}
              onChange={(e) => setScoreMath(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
            />
          </Field>
          <Field label="Language Usage">
            <input
              type="number"
              min={100}
              max={350}
              placeholder="100~350"
              value={scoreLanguage}
              onChange={(e) => setScoreLanguage(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
            />
          </Field>
        </div>
      ) : (
        <LevelTestScoreEditor
          testType={testType}
          value={scoreDetail}
          onChange={setScoreDetail}
        />
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !row}
        >
          {save.isPending
            ? t('common:actions.saving')
            : t('detail.levelTest.recordResult')}
        </Button>
      </div>
      {save.isError && (
        <p className="text-xs text-red-600">
          {(save.error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? (save.error as Error).message}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ResultPreviewDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  row: LevelTest | null;
}) {
  const { t } = useTranslation(['csl']);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('detail.levelTest.previewResultTitle', {
              defaultValue: '레벨테스트 결과 미리보기',
            })}
          </DialogTitle>
        </DialogHeader>
        {!row ? (
          <p className="text-sm text-secondary">-</p>
        ) : row.testType === 'MAP' ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <PreviewItem label="Reading" value={row.scoreReading} />
            <PreviewItem label="Math" value={row.scoreMath} />
            <PreviewItem label="Language Usage" value={row.scoreLanguage} />
          </div>
        ) : (
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3 text-sm">
            <DetailPreviewTree value={row.scoreDetail} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3">
      <div className="text-xs text-secondary">{label}</div>
      <div className="mt-1 text-base font-semibold">{value ?? '—'}</div>
    </div>
  );
}

function DetailPreviewTree({
  value,
  depth = 0,
}: {
  value: Record<string, unknown> | null;
  depth?: number;
}) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-sm text-secondary">—</p>;
  }

  return (
    <div className="grid gap-2">
      {Object.entries(value).map(([key, entry]) => {
        const isObject =
          typeof entry === 'object' && entry !== null && !Array.isArray(entry);
        return (
          <div
            key={`${depth}-${key}`}
            className={depth > 0 ? 'pl-3 border-l border-[var(--border-subtle)]' : ''}
          >
            <div className="text-xs font-medium text-secondary">{key}</div>
            {isObject ? (
              <DetailPreviewTree
                value={entry as Record<string, unknown>}
                depth={depth + 1}
              />
            ) : (
              <div className="mt-0.5 text-sm">{String(entry ?? '—')}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
