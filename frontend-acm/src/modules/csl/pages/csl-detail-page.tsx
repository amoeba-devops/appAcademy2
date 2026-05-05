import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CslStageStepper } from '@/modules/csl/components/csl-stage-stepper';
import { MapTestPanel } from '@/modules/csl/components/map-test-panel';
import { TrialClassPanel } from '@/modules/csl/components/trial-class-panel';
import { EnrollmentPanel } from '@/modules/csl/components/enrollment-panel';
import { CancellationDialog } from '@/modules/csl/components/cancellation-dialog';
import { RemarksPanel } from '@/modules/csl/components/remarks-panel';

export type CslStage =
  | 'INTAKE'
  | 'MAP_TEST'
  | 'TRIAL_CLASS'
  | 'ENROLLMENT_COUNSELING'
  | 'PAYMENT'
  | 'CLASS_STARTED'
  | 'DROPPED';

interface InquiryDetail {
  id: string;
  seqNo: number;
  studentName: string;
  isAnonymous: boolean;
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
}

const FORWARD: Record<CslStage, CslStage[]> = {
  INTAKE: ['MAP_TEST', 'TRIAL_CLASS'],
  MAP_TEST: ['TRIAL_CLASS'],
  TRIAL_CLASS: ['ENROLLMENT_COUNSELING'],
  ENROLLMENT_COUNSELING: ['PAYMENT'],
  PAYMENT: ['CLASS_STARTED'],
  CLASS_STARTED: [],
  DROPPED: [],
};

export function CslDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: inq, isLoading } = useQuery({
    queryKey: ['csl', 'detail', id],
    queryFn: async () => {
      const res = await apiClient.get<InquiryDetail>(`/acm/csl/inquiries/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const forward = useMutation({
    mutationFn: async (toStage: CslStage) => {
      setErrorMsg(null);
      const res = await apiClient.post(`/acm/csl/inquiries/${id}/transitions`, { toStage });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl'] }),
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) =>
      setErrorMsg(e.response?.data?.message ?? e.message ?? 'Transition failed'),
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const res = await apiClient.post(`/acm/csl/inquiries/${id}/reactivate`);
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

  if (isLoading || !inq) {
    return <p className="text-secondary">{t('common:status.loading')}</p>;
  }

  const allowedForward = FORWARD[inq.currentStage];
  const isDropped = inq.currentStage === 'DROPPED';

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/csl')}
            className="text-xs text-secondary hover:text-primary mb-2"
          >
            ← {t('detail.backToList')}
          </button>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-secondary mt-1">
            #{inq.seqNo} · {t(`inflow.${inq.inflowType}`)} · {t(`applyType.${inq.applyType}`)}
            {inq.schoolFreetext && ` · ${inq.schoolFreetext}`}
            {inq.grade && ` (${t(`grade.${inq.grade}`, inq.grade)})`}
          </p>
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
          {!isDropped && (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              {t('detail.drop')}
            </Button>
          )}
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

      {/* Stepper */}
      <CslStageStepper currentStage={inq.currentStage} />

      {/* Active sub-stage panel */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4">
          {(inq.currentStage === 'MAP_TEST' || inq.currentStage === 'INTAKE') && (
            <MapTestPanel inqId={inq.id} />
          )}
          {inq.currentStage === 'TRIAL_CLASS' && <TrialClassPanel inqId={inq.id} />}
          {(inq.currentStage === 'ENROLLMENT_COUNSELING' ||
            inq.currentStage === 'PAYMENT' ||
            inq.currentStage === 'CLASS_STARTED') && <EnrollmentPanel inqId={inq.id} />}
        </div>
        <RemarksPanel inqId={inq.id} />
      </div>

      <CancellationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        inqId={inq.id}
      />
    </div>
  );
}
