import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Play, RefreshCw, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * REQ-260912B — 수업 상세의 보다스쿨 녹화본 섹션 (상세페이지·상세모달 공용).
 *
 * 보다 SERVER API 에는 공개 재생 URL 이 없어 ACM 백엔드가 프록시한다.
 * `<video>` 는 Authorization 헤더를 못 실으므로 5분짜리 티켓 URL 을 받아 쓴다.
 * 녹화본은 학원 운영자(ADMIN·STAFF)와 강사에게만 노출된다 — 백엔드가 역할을
 * 강제하고, 프론트는 403 이면 섹션을 감춘다.
 */

type ArchiveStatus = 'PENDING' | 'ARCHIVING' | 'ARCHIVED' | 'FAILED' | 'MISSING';

type RecordingEventStatus =
  | 'NOT_APPLICABLE'
  | 'NO_ROOM'
  | 'UPCOMING'
  | 'IN_PROGRESS'
  | 'AWAITING'
  | 'NO_RECORDING'
  | 'AVAILABLE';

interface RecordingItem {
  recordIdx: number;
  title: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  fileExist: boolean;
  archiveStatus: ArchiveStatus;
  sizeBytes: string | null;
  playable: boolean;
}

interface RecordingSummary {
  status: RecordingEventStatus;
  roomStatus: string | null;
  counts: { total: number; archived: number; pending: number; failed: number };
  items: RecordingItem[];
}

interface TicketResponse {
  url: string;
  downloadUrl: string;
  expiresInSec: number;
}

/** 녹화 상태 배지 색 — 진행/대기/없음/보유를 한눈에. */
const STATUS_BADGE: Record<RecordingEventStatus, string> = {
  NOT_APPLICABLE: 'bg-[var(--gray-100)] text-secondary border-[var(--border-subtle)]',
  NO_ROOM: 'bg-[var(--gray-100)] text-secondary border-[var(--border-subtle)]',
  UPCOMING: 'bg-[var(--gray-100)] text-secondary border-[var(--border-subtle)]',
  IN_PROGRESS: 'bg-green-100 text-green-800 border-green-300',
  AWAITING: 'bg-amber-100 text-amber-800 border-amber-300',
  NO_RECORDING: 'bg-[var(--gray-100)] text-secondary border-[var(--border-subtle)]',
  AVAILABLE: 'bg-violet-100 text-violet-800 border-violet-300',
};

export function CalRecordingsSection({
  evtId,
  isBoda,
  canSync = true,
}: {
  evtId: string;
  isBoda: boolean;
  /** 즉시 동기화 버튼 노출 (백엔드는 ADMIN·STAFF 만 허용). */
  canSync?: boolean;
}) {
  const { t } = useTranslation(['cal', 'common']);
  const toast = useToast();
  const qc = useQueryClient();
  const [playing, setPlaying] = useState<{
    item: RecordingItem;
    url: string;
    downloadUrl: string;
  } | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const { data, error } = useQuery({
    enabled: isBoda && !!evtId,
    queryKey: ['cal', 'recordings', evtId],
    queryFn: async () =>
      (await apiClient.get<RecordingSummary>(`/acm/cal/events/${evtId}/recordings`))
        .data,
    retry: false,
  });

  const syncMut = useMutation({
    mutationFn: async () =>
      (await apiClient.post<RecordingSummary>(`/acm/cal/events/${evtId}/recordings/sync`))
        .data,
    onSuccess: (res) => {
      qc.setQueryData(['cal', 'recordings', evtId], res);
      toast.success(
        res.counts.total > 0
          ? t('recordings.syncFound', {
              defaultValue: '녹화본 {{count}}건을 확인했습니다.',
              count: res.counts.total,
            })
          : t('recordings.syncEmpty', '보다스쿨에 저장된 녹화본이 없습니다.'),
      );
    },
    onError: () =>
      toast.error(t('recordings.syncFailed', '녹화본 동기화에 실패했습니다.')),
  });

  // 권한 없음(403)·룸 없음 → 섹션 자체를 감춘다.
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (!isBoda || status === 403 || !data || data.status === 'NOT_APPLICABLE') {
    return null;
  }

  const open = async (item: RecordingItem, download: boolean) => {
    setBusyIdx(item.recordIdx);
    try {
      const res = await apiClient.post<TicketResponse>(
        `/acm/cal/events/${evtId}/recordings/${item.recordIdx}/ticket`,
      );
      if (download) {
        window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        setPlaying({
          item,
          url: res.data.url,
          downloadUrl: res.data.downloadUrl,
        });
      }
    } catch {
      toast.error(t('recordings.openFailed', '녹화본을 열지 못했습니다.'));
    } finally {
      setBusyIdx(null);
    }
  };

  const files = data.items.filter((r) => r.playable);

  return (
    <div className="mt-4 rounded-md border border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-secondary">
          🎬 {t('recordings.title', '수업 녹화본')}
        </span>
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[data.status]}`}
        >
          {t(`recordings.status.${data.status}`, data.status)}
        </span>
        {data.counts.pending > 0 && (
          <span className="text-[11px] text-secondary">
            {t('recordings.archiving', {
              defaultValue: '서버 보관 중 {{count}}건',
              count: data.counts.pending,
            })}
          </span>
        )}
        {data.counts.failed > 0 && (
          <span className="text-[11px] text-red-700">
            {t('recordings.archiveFailed', {
              defaultValue: '보관 실패 {{count}}건',
              count: data.counts.failed,
            })}
          </span>
        )}
        {canSync && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7 px-2 text-xs"
            disabled={syncMut.isPending}
            onClick={() => syncMut.mutate()}
          >
            {syncMut.isPending ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <RefreshCw size={12} className="mr-1" />
            )}
            {t('recordings.syncBtn', '녹화본 동기화')}
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-secondary">
          {t(`recordings.empty.${data.status}`, {
            defaultValue: t(
              'recordings.empty.NO_RECORDING',
              '저장된 녹화본이 없습니다.',
            ),
          })}
        </p>
      ) : (
        <ul className="grid gap-1">
          {files.map((r) => (
            <li
              key={r.recordIdx}
              className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {r.title || `${t('recordings.file', '녹화')} #${r.recordIdx}`}
              </span>
              <span className="shrink-0 text-[11px] text-secondary">
                {formatSpan(r)}
                {r.archiveStatus === 'ARCHIVED' && r.sizeBytes
                  ? ` · ${formatSize(r.sizeBytes)}`
                  : ''}
              </span>
              {r.archiveStatus !== 'ARCHIVED' && (
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                  {t('recordings.notArchived', '보다스쿨 원본')}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={busyIdx === r.recordIdx}
                onClick={() => void open(r, false)}
              >
                {busyIdx === r.recordIdx ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <Play size={12} className="mr-1" />
                )}
                {t('recordings.play', '재생')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={busyIdx === r.recordIdx}
                onClick={() => void open(r, true)}
              >
                <Download size={12} className="mr-1" />
                {t('recordings.download', '다운로드')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-3xl rounded-md bg-surface p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                {playing.item.title ||
                  `${t('recordings.file', '녹화')} #${playing.item.recordIdx}`}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  window.open(playing.downloadUrl, '_blank', 'noopener,noreferrer')
                }
              >
                <Download size={12} className="mr-1" />
                {t('recordings.download', '다운로드')}
              </Button>
              <button
                type="button"
                aria-label={t('common:actions.close', '닫기')}
                className="rounded p-1 text-secondary hover:bg-[var(--gray-100)]"
                onClick={() => setPlaying(null)}
              >
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={playing.url}
              controls
              autoPlay
              className="max-h-[70vh] w-full rounded bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** YYYY-MM-DDTHH:mm 형태를 MM/DD HH:mm 으로 — 보다가 준 원본 시각 그대로. */
function formatSpan(r: RecordingItem): string {
  const fmt = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };
  const start = fmt(r.startedAt);
  const end = fmt(r.endedAt);
  if (start && end) return `${start} ~ ${end}`;
  if (start) return start;
  if (r.durationSec) return `${Math.round(r.durationSec / 60)}분`;
  return '';
}

function formatSize(bytes: string): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`;
}
