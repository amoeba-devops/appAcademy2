import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInviteeCandidates } from '../hooks/use-cal-events';
import type { CalInviteeKind, InviteeCandidate } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (picked: InviteeCandidate[]) => void;
  excludeKeys: Set<string>;
}

export function InviteePickerModal({ open, onClose, onPick, excludeKeys }: Props) {
  const { t } = useTranslation('cal');
  const [q, setQ] = useState('');
  // PLN-260718 — 종류는 학생/강사/학부모만(ALL 제거), 기본 학생.
  const [kind, setKind] = useState<CalInviteeKind>('STUDENT');
  const [picked, setPicked] = useState<Map<string, InviteeCandidate>>(new Map());

  const { data: candidates = [], isFetching } = useInviteeCandidates(q, kind, open);

  const keyOf = (c: InviteeCandidate) => `${c.kind}:${c.refId}`;

  const handleConfirm = () => {
    onPick(Array.from(picked.values()));
    setPicked(new Map());
    setQ('');
    onClose();
  };

  const toggle = (c: InviteeCandidate) => {
    const next = new Map(picked);
    const k = keyOf(c);
    if (next.has(k)) next.delete(k);
    else next.set(k, c);
    setPicked(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPicked(new Map());
          setQ('');
          onClose();
        }
      }}
    >
      <DialogContent className="top-[8vh] max-w-xl max-h-[85vh] translate-y-0 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('invitee.pickerTitle', '참석자 선택')}</DialogTitle>
        </DialogHeader>

        <p className="mb-2 text-xs text-secondary">
          {t('invitee.pickerHint', '수업에 참여할 학생을 추가하세요. 다른 강사도 추가 가능합니다.')}
        </p>

        <div className="flex gap-2 mb-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CalInviteeKind)}
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-sm"
          >
            <option value="STUDENT">{t('invitee.kindStudent', '학생')}</option>
            <option value="TEACHER">{t('invitee.kindTeacher', '강사')}</option>
            <option value="PARENT">{t('invitee.kindParent', '학부모')}</option>
          </select>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('invitee.searchPlaceholder', '이름·이메일 검색')}
            className="flex-1 h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto border border-[var(--border-subtle)] rounded-md">
          {isFetching && (
            <p className="text-xs text-secondary p-3">{t('common:status.loading', '로딩 중…')}</p>
          )}
          {!isFetching && candidates.length === 0 && (
            <p className="text-xs text-secondary p-3">{t('invitee.empty', '결과가 없습니다.')}</p>
          )}
          <ul className="divide-y divide-[var(--border-subtle)]">
            {candidates.map((c) => {
              const k = keyOf(c);
              const isExcluded = excludeKeys.has(k);
              const isChecked = picked.has(k);
              return (
                <li
                  key={k}
                  className={`p-2 flex items-center gap-3 ${isExcluded ? 'opacity-40' : 'hover:bg-[var(--canvas-subtle)] cursor-pointer'}`}
                  onClick={() => !isExcluded && toggle(c)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isExcluded}
                    onChange={() => toggle(c)}
                    className="h-4 w-4"
                  />
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                      c.kind === 'STUDENT'
                        ? 'bg-blue-100 text-blue-700'
                        : c.kind === 'TEACHER'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {c.kind}
                  </span>
                  <span className="text-sm text-primary font-medium">{c.name}</span>
                  {c.email ? (
                    <span className="text-xs text-secondary">{c.email}</span>
                  ) : (
                    <span className="text-xs text-amber-700">
                      {t('invitee.noEmail', '(이메일 없음)')}
                    </span>
                  )}
                  {c.subInfo && (
                    <span className="text-xs text-secondary ml-auto truncate max-w-[180px]">
                      {c.subInfo}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common:actions.cancel', '취소')}
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} disabled={picked.size === 0}>
            {t('invitee.add', '추가')} ({picked.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
