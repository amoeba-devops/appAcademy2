import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CslStageStepper } from '@/modules/csl/components/csl-stage-stepper';
import { IntakeStagePanel } from '@/modules/csl/components/intake-stage-panel';
import { LevelTestPanel } from '@/modules/csl/components/level-test-panel';
import { TrialClassPanel } from '@/modules/csl/components/trial-class-panel';
import { EnrollmentPanel } from '@/modules/csl/components/enrollment-panel';
import { CancellationDialog } from '@/modules/csl/components/cancellation-dialog';
import { RemarksPanel } from '@/modules/csl/components/remarks-panel';
import { ClassStatusSummaryPanel } from '@/modules/csl/components/class-status-summary-panel';

export type CslStage =
  | 'INTAKE'
  | 'MAP_TEST'
  | 'TRIAL_CLASS'
  | 'ENROLLMENT_COUNSELING'
  | 'PAYMENT'
  | 'CLASS_STARTED'
  | 'ATTENDING'
  | 'DROPPED';

interface InquiryDetail {
  id: string;
  seqNo: number;
  studentName: string;
  isAnonymous: boolean;
  parentName: string | null;
  parentPhone: string | null;
  phoneStatus: 'PROVIDED' | 'DECLINED' | 'UNKNOWN';
  schoolFreetext?: string | null;
  grade?: string | null;
  inflowType: 'HOMEPAGE' | 'KAKAO_CHANNEL' | 'PHONE';
  applyType: 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
  applyPurposes?: string[];
  consultDone?: 'YES' | 'NO' | null;
  currentStage: CslStage;
  previousStage?: CslStage | null;
  registeredAt: string;
  followupAt?: string | null;
  followupMemo?: string | null;
  // PLN-260718 요구3 — 수강등록으로 연결된 STD 학생 (없으면 null).
  linkedStudent?: { id: string; name: string; status: string } | null;
}

// 헤더의 "→ 단계" 진행 버튼 맵. CLASS_STARTED→ATTENDING(수강중) 전환은 헤더
// 버튼이 아니라 6단계 패널의 [수강등록완료] 버튼이 담당하므로 여기서는 비워둔다.
const FORWARD: Record<CslStage, CslStage[]> = {
  INTAKE: ['MAP_TEST', 'TRIAL_CLASS'],
  MAP_TEST: ['TRIAL_CLASS'],
  TRIAL_CLASS: ['ENROLLMENT_COUNSELING'],
  ENROLLMENT_COUNSELING: ['PAYMENT'],
  PAYMENT: ['CLASS_STARTED'],
  CLASS_STARTED: [],
  ATTENDING: [],
  DROPPED: [],
};

/**
 * `/admin/csl/:id` route entry. Reads inqId from URL, renders the
 * shared detail body with the standard "← 상담목록으로" back link.
 */
export function CslDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['csl', 'common']);

  if (!id) {
    return <p className="text-secondary">{t('common:status.error')}</p>;
  }

  return (
    <CslDetailBody
      inqId={id}
      onBack={() => navigate('/admin/csl')}
      backLabel={t('detail.backToList')}
      variant="page"
    />
  );
}

/**
 * REQ-260701 modal enhancement — the same body content, rendered inside
 * a Dialog from the kanban board.
 *
 *   • variant='page'  → header shows "← 상담목록으로" (list navigate)
 *   • variant='modal' → callers control layout; back button becomes ✕ close
 */
export function CslDetailBody({
  inqId,
  onBack,
  backLabel,
  variant = 'page',
}: {
  inqId: string;
  onBack?: () => void;
  backLabel?: string;
  variant?: 'page' | 'modal';
}) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<CslStage | null>(null);

  const { data: inq, isLoading } = useQuery({
    queryKey: ['csl', 'detail', inqId],
    queryFn: async () => {
      const res = await apiClient.get<InquiryDetail>(`/acm/csl/inquiries/${inqId}`);
      return res.data;
    },
    enabled: !!inqId,
  });

  const forward = useMutation({
    mutationFn: async (toStage: CslStage) => {
      setErrorMsg(null);
      const res = await apiClient.post(
        `/acm/csl/inquiries/${inqId}/transitions`,
        { toStage },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl'] }),
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) =>
      setErrorMsg(e.response?.data?.message ?? e.message ?? 'Transition failed'),
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const res = await apiClient.post(`/acm/csl/inquiries/${inqId}/reactivate`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl'] }),
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) =>
      setErrorMsg(e.response?.data?.message ?? e.message ?? 'Reactivate failed'),
  });

  const displayName = useMemo(() => {
    if (!inq) return '';
    return inq.isAnonymous ? t('anonymousInquiry', { seqNo: inq.seqNo }) : inq.studentName;
  }, [inq, t]);

  useEffect(() => {
    if (inq?.currentStage) setSelectedStage(inq.currentStage);
  }, [inq?.currentStage]);

  if (isLoading || !inq) {
    return <p className="text-secondary">{t('common:status.loading')}</p>;
  }

  const allowedForward = FORWARD[inq.currentStage];
  const isDropped = inq.currentStage === 'DROPPED';
  const effectiveSelected: CslStage = isDropped
    ? inq.currentStage
    : (selectedStage ?? inq.currentStage);

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-secondary hover:text-primary mb-2"
            >
              {variant === 'modal' ? '✕' : '←'}{' '}
              {backLabel ?? t('detail.backToList')}
            </button>
          )}
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-secondary mt-1">
            #{inq.seqNo} · {t(`inflow.${inq.inflowType}`)} · {t(`applyType.${inq.applyType}`)}
            {inq.schoolFreetext && ` · ${inq.schoolFreetext}`}
            {inq.grade && ` (${t(`grade.${inq.grade}`, inq.grade)})`}
          </p>
          {(inq.parentName || inq.parentPhone) && (
            <p className="text-sm text-secondary mt-1">
              👪 {inq.parentName ?? '—'}
              {inq.parentPhone && ` · ☎ ️ ${inq.parentPhone}`}
            </p>
          )}
          {inq.linkedStudent && (
            <p className="mt-1 text-sm">
              <span className="text-secondary">
                🎓 {t('detail.linkedStudent', '수강등록 연결')}:{' '}
              </span>
              <Link
                to={`/admin/std/${inq.linkedStudent.id}`}
                className="font-medium text-accent-700 hover:underline"
              >
                {inq.linkedStudent.name}
              </Link>
              <span className="ml-1 text-xs text-secondary">
                ({t(`std:status.${inq.linkedStudent.status}`, inq.linkedStudent.status)})
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isDropped &&
            allowedForward.map((s) => (
              <Button
                key={s}
                onClick={() => forward.mutate(s)}
                disabled={forward.isPending}
              >
                → {t(`stage.${s}`)}
              </Button>
            ))}
          {isDropped && (
            <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
              {t('detail.reactivate')}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <CslStageStepper
        currentStage={inq.currentStage}
        selectedStage={effectiveSelected}
        onSelect={(stage) => setSelectedStage(stage)}
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4">
          {effectiveSelected === 'INTAKE' && (
            <IntakeStagePanel
              inqId={inq.id}
              onAfterAdvance={
                inq.currentStage === 'INTAKE'
                  ? () => forward.mutate('MAP_TEST')
                  : undefined
              }
            />
          )}
          {effectiveSelected === 'MAP_TEST' && (
            <LevelTestPanel inqId={inq.id} />
          )}
          {effectiveSelected === 'TRIAL_CLASS' && (
            <TrialClassPanel inqId={inq.id} />
          )}
          {(effectiveSelected === 'ENROLLMENT_COUNSELING' ||
            effectiveSelected === 'PAYMENT') && (
            <EnrollmentPanel
              inqId={inq.id}
              currentStage={effectiveSelected}
              onAfterAdvance={
                inq.currentStage === effectiveSelected
                  ? (next) => forward.mutate(next)
                  : undefined
              }
            />
          )}
          {(effectiveSelected === 'CLASS_STARTED' ||
            effectiveSelected === 'ATTENDING') && (
            <ClassStatusSummaryPanel
              inqId={inq.id}
              currentStage={inq.currentStage}
            />
          )}
        </div>
        <RemarksPanel
          inqId={inq.id}
          headerAction={
            !isDropped ? (
              <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
                {t('detail.drop')}
              </Button>
            ) : undefined
          }
        />
      </div>

      <CancellationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        inqId={inq.id}
      />
    </div>
  );
}
