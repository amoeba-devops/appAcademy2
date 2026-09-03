import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Mail, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { ParentPickOrCreateDialog } from '@/modules/std/components/parent-pick-or-create-dialog';
import { useTenantTz } from '@/lib/tz';

/**
 * REQ-260902 — 피드백 학부모 메일 발송 모달.
 * 수신 대상 = 이벤트 참여 학생의 연결 학부모(이메일 보유자 기본 체크).
 * 학부모 미연결 학생은 이 자리에서 검색·연결(기존 std 다이얼로그 재사용).
 */

interface RecipientParent {
  parId: string;
  name: string;
  relation: string | null;
  email: string | null;
  isPrimary: boolean;
}

interface RecipientStudent {
  stdId: string;
  stdName: string;
  parents: RecipientParent[];
}

interface RecipientsView {
  smtpConfigured: boolean;
  hasFeedback: boolean;
  students: RecipientStudent[];
}

type SendStatus = 'SENT' | 'NO_EMAIL' | 'FAILED';

interface SendResult {
  stdId: string;
  parId: string;
  status: SendStatus;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  evtId: string;
  eventTitle: string;
  eventStartAt: string; // ISO
}

const pairKey = (stdId: string, parId: string) => `${stdId}:${parId}`;

export function FeedbackEmailDialog({
  open,
  onClose,
  evtId,
  eventTitle,
  eventStartAt,
}: Props) {
  const { t, i18n } = useTranslation(['cal', 'common']);
  const toast = useToast();
  const tz = useTenantTz(); // REQ-260903 — 제목 일시는 테넌트 TZ 기준
  const queryClient = useQueryClient();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [results, setResults] = useState<Map<string, SendResult> | null>(null);
  const [matchingStdId, setMatchingStdId] = useState<string | null>(null);

  const recipientsKey = ['cal', 'feedback-recipients', evtId];
  const { data, isLoading } = useQuery({
    enabled: open && !!evtId,
    queryKey: recipientsKey,
    queryFn: async () =>
      (
        await apiClient.get<RecipientsView>(
          `/acm/cal/events/${evtId}/review/recipients`,
        )
      ).data,
  });

  const defaultSubject = useMemo(() => {
    const date = new Intl.DateTimeFormat(i18n.language, {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(eventStartAt));
    return t('cal:feedbackEmail.subjectTemplate', {
      title: eventTitle,
      date,
    });
  }, [t, i18n.language, eventTitle, eventStartAt, tz]);

  // 열 때 초기화 — 이메일 보유 학부모 전원 기본 체크 (Q-D 확정).
  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setResults(null);
  }, [open, defaultSubject]);

  // 데이터 도착·재조회 시(발송 전이면) 이메일 보유 학부모 전원 기본 체크
  useEffect(() => {
    if (!open || !data || results !== null) return;
    const next = new Set<string>();
    for (const s of data.students) {
      for (const p of s.parents) {
        if (p.email) next.add(pairKey(s.stdId, p.parId));
      }
    }
    setChecked(next);
  }, [open, data, results]);

  const sendMut = useMutation({
    mutationFn: async (recipients: Array<{ stdId: string; parId: string }>) =>
      (
        await apiClient.post<{ results: SendResult[] }>(
          `/acm/cal/events/${evtId}/review/send-email`,
          { recipients, subject: subject.trim() || undefined },
        )
      ).data,
    onSuccess: (res) => {
      const map = new Map<string, SendResult>();
      let sent = 0;
      let failed = 0;
      for (const r of res.results) {
        map.set(pairKey(r.stdId, r.parId), r);
        if (r.status === 'SENT') sent++;
        else if (r.status === 'FAILED') failed++;
      }
      setResults(map);
      if (failed === 0) {
        toast.success(t('cal:feedbackEmail.sentToast', { count: sent }));
      } else {
        toast.error(t('cal:feedbackEmail.partialFailToast', { failed }));
      }
    },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: { message?: string } } } })
        .response?.data;
      const msg = data?.error?.message;
      toast.error(
        msg === 'SMTP_NOT_CONFIGURED'
          ? t('cal:feedbackEmail.smtpNotConfigured')
          : t('cal:feedbackEmail.sendFailed'),
      );
    },
  });

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedRecipients = useMemo(() => {
    const out: Array<{ stdId: string; parId: string }> = [];
    for (const s of data?.students ?? []) {
      for (const p of s.parents) {
        if (checked.has(pairKey(s.stdId, p.parId))) {
          out.push({ stdId: s.stdId, parId: p.parId });
        }
      }
    }
    return out;
  }, [data, checked]);

  const relationLabel = (rel: string | null) =>
    rel ? t(`cal:feedbackEmail.relation.${rel}`, rel) : '';

  const smtpBlocked = data ? !data.smtpConfigured : false;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Mail size={16} />
              {t('cal:feedbackEmail.title', '피드백 메일 발송')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-secondary">
              {t(
                'cal:feedbackEmail.recipientsTitle',
                '수신 대상 — 참여 학생의 연결 학부모',
              )}
            </p>

            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-[var(--border-subtle)] p-2">
              {isLoading && (
                <p className="p-2 text-xs text-secondary">
                  {t('common:status.loading')}
                </p>
              )}
              {!isLoading && (data?.students.length ?? 0) === 0 && (
                <p className="p-2 text-xs text-secondary">
                  {t('cal:feedbackEmail.noStudents', '참여 학생이 없습니다.')}
                </p>
              )}
              {data?.students.map((s) =>
                s.parents.length === 0 ? (
                  <div
                    key={s.stdId}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <span className="font-medium">{s.stdName}</span>
                      <span className="text-xs text-secondary">
                        {t('cal:feedbackEmail.noParent', '연결된 학부모 없음')}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMatchingStdId(s.stdId)}
                    >
                      <Search size={12} className="mr-1" />
                      {t('cal:feedbackEmail.findParent', '학부모 찾기·연결')}
                    </Button>
                  </div>
                ) : (
                  s.parents.map((p) => {
                    const key = pairKey(s.stdId, p.parId);
                    const result = results?.get(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--canvas-subtle)] ${
                          p.email ? 'cursor-pointer' : 'opacity-70'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={!p.email || sendMut.isPending}
                            checked={checked.has(key)}
                            onChange={() => toggle(key)}
                          />
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{s.stdName}</span>
                            <span className="mx-1 text-secondary">·</span>
                            {relationLabel(p.relation) && (
                              <span className="mr-1 text-xs text-secondary">
                                {relationLabel(p.relation)}
                              </span>
                            )}
                            {p.name}
                            {p.isPrimary && (
                              <span className="ml-1 rounded bg-accent-600/10 px-1 py-0.5 text-[10px] font-semibold text-accent-700">
                                {t('cal:feedbackEmail.primaryBadge', '대표')}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-secondary">
                          {result ? (
                            <span
                              className={
                                result.status === 'SENT'
                                  ? 'font-semibold text-emerald-600'
                                  : result.status === 'FAILED'
                                    ? 'font-semibold text-red-600'
                                    : ''
                              }
                              title={result.error}
                            >
                              {t(`cal:feedbackEmail.result.${result.status}`)}
                            </span>
                          ) : (
                            (p.email ?? t('cal:feedbackEmail.noEmail', '이메일 없음'))
                          )}
                        </span>
                      </label>
                    );
                  })
                ),
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-secondary">
                {t('cal:feedbackEmail.subjectLabel', '제목')}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                disabled={sendMut.isPending}
                className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40"
              />
            </div>

            {smtpBlocked && (
              <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={13} />
                {t(
                  'cal:feedbackEmail.smtpNotConfigured',
                  '메일 서버(SMTP)가 설정되지 않아 발송할 수 없습니다.',
                )}
              </p>
            )}
            {data && !data.hasFeedback && (
              <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={13} />
                {t('cal:feedbackEmail.noFeedback', '작성된 피드백이 없습니다.')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={sendMut.isPending}>
              {t('common:actions.cancel', '취소')}
            </Button>
            <Button
              onClick={() => sendMut.mutate(selectedRecipients)}
              disabled={
                sendMut.isPending ||
                selectedRecipients.length === 0 ||
                smtpBlocked ||
                !data?.hasFeedback
              }
            >
              {sendMut.isPending && (
                <Loader2 size={13} className="mr-1 animate-spin" />
              )}
              {sendMut.isPending
                ? t('cal:feedbackEmail.sending', '발송 중…')
                : t('cal:feedbackEmail.send', {
                    count: selectedRecipients.length,
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {matchingStdId && (
        <ParentPickOrCreateDialog
          open={!!matchingStdId}
          stdId={matchingStdId}
          onClose={() => {
            setMatchingStdId(null);
            setResults(null);
            void queryClient.invalidateQueries({ queryKey: recipientsKey });
          }}
        />
      )}
    </>
  );
}
