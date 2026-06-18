import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BodaInviteeView } from '@/lib/boda-launch-api';

/**
 * REQ-260619 FR-LX-1.1 — 수강생 전체 목록 모달.
 *
 * `+N` 칩 클릭 시 강사·운영자만 진입 가능. 학생/학부모 화면에서는
 * 백엔드가 빈 배열을 반환하므로 본 모달 자체가 호출되지 않음.
 */
export function AttendeesModal({
  open,
  onClose,
  invitees,
}: {
  open: boolean;
  onClose: () => void;
  invitees: BodaInviteeView[];
}) {
  const { t } = useTranslation('classroom');

  const groupLabel = (kind: 'STUDENT' | 'TEACHER' | 'PARENT'): string =>
    kind === 'STUDENT'
      ? t('attendees.kindStudent')
      : kind === 'TEACHER'
        ? t('attendees.kindTeacher')
        : t('attendees.kindParent');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('attendees.modalTitle', { count: invitees.length })}
          </DialogTitle>
        </DialogHeader>

        <ul className="mt-3 space-y-1">
          {invitees.map((i) => (
            <li
              key={`${i.kind}:${i.refId}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-subtle)] text-xs"
            >
              <span
                className={`text-[9px] font-mono uppercase px-1 py-0.5 rounded ${
                  i.kind === 'STUDENT'
                    ? 'bg-blue-100 text-blue-700'
                    : i.kind === 'TEACHER'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {groupLabel(i.kind)[0]}
              </span>
              <span className="text-primary flex-1 min-w-0 truncate">
                {i.name}
              </span>
              {i.subLabel && (
                <span className="text-[10px] text-secondary truncate">
                  {i.subLabel}
                </span>
              )}
              {i.notified ? (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] text-green-700"
                  title={t('attendees.notifiedTrue')}
                >
                  <CheckCircle2 size={10} />
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] text-secondary"
                  title={t('attendees.notifiedFalse')}
                >
                  <Circle size={10} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
