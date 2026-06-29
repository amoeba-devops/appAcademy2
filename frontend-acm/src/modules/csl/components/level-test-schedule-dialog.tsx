import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AmaUserPicker } from '@/components/common/ama-user-picker';
import type { AmaPlatformUser } from '@/lib/ama-user-api';

/**
 * DSN-260629 §6.4 — 응시예정일 + 시간 + 담당강사 한꺼번에 잡는 모달.
 * 저장 시 PUT /level-tests/:type 호출 → 백엔드가 CAL linker 자동 fire.
 *
 *   📅 (날짜)   시간 [▼ 30분 슬롯]   담당강사 [▼]
 *
 * Status 는 별도 inline select 에서 처리 (모달 안에 두면 동선이 길어짐).
 */

const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 9; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
})();

interface LevelTestRow {
  testType: string;
  testTypeOther: string | null;
  scheduledAt: string | null;
  scheduledTime: string | null;
  teacherId: string | null;
  /** Display-only seed for the AMA picker when the row was previously saved
   *  with a teacherAmaUserId. Pulled from the level-test list response (see
   *  level-test-panel `teacherAmaUserId`/`teacherAmaName`/`teacherAmaEmail`). */
  teacherAmaUserId?: string | null;
  teacherAmaName?: string | null;
  teacherAmaEmail?: string | null;
}

export function LevelTestScheduleDialog({
  open,
  onOpenChange,
  inqId,
  row,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  inqId: string;
  /** Current row state — testType used to scope the request. */
  row: LevelTestRow;
  onSaved?: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();

  const [scheduledAt, setScheduledAt] = useState(row.scheduledAt ?? '');
  const [scheduledTime, setScheduledTime] = useState(
    row.scheduledTime ? row.scheduledTime.slice(0, 5) : '',
  );
  // REQ-260629 — picker holds the full AMA user object. Saved row may only
  // have teacherId (legacy) or amaUserId — we seed with whatever the parent
  // passes; if both absent the picker starts empty.
  const initialAma: AmaPlatformUser | null = row.teacherAmaUserId
    ? {
        userId: row.teacherAmaUserId,
        entityId: '',
        level: 'MEMBER',
        name: row.teacherAmaName ?? row.teacherAmaUserId,
        email: row.teacherAmaEmail ?? '',
      }
    : null;
  const [amaUser, setAmaUser] = useState<AmaPlatformUser | null>(initialAma);

  // Re-sync when row changes (different exam type opened in same dialog instance).
  useEffect(() => {
    setScheduledAt(row.scheduledAt ?? '');
    setScheduledTime(row.scheduledTime ? row.scheduledTime.slice(0, 5) : '');
    setAmaUser(
      row.teacherAmaUserId
        ? {
            userId: row.teacherAmaUserId,
            entityId: '',
            level: 'MEMBER',
            name: row.teacherAmaName ?? row.teacherAmaUserId,
            email: row.teacherAmaEmail ?? '',
          }
        : null,
    );
  }, [
    row.testType,
    row.scheduledAt,
    row.scheduledTime,
    row.teacherAmaUserId,
    row.teacherAmaName,
    row.teacherAmaEmail,
  ]);

  const save = useMutation({
    mutationFn: async () => {
      await apiClient.put(
        `/acm/csl/inquiries/${inqId}/level-tests/${row.testType}`,
        {
          scheduledAt: scheduledAt || undefined,
          scheduledTime: scheduledTime ? `${scheduledTime}:00` : undefined,
          teacherAmaUserId: amaUser?.userId || undefined,
          teacherAmaName: amaUser?.name || undefined,
          teacherAmaEmail: amaUser?.email || undefined,
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csl', 'level-tests', inqId] });
      onSaved?.();
      onOpenChange(false);
    },
  });

  const testLabel =
    row.testType === 'OTHER' && row.testTypeOther
      ? `Other (${row.testTypeOther})`
      : row.testType === 'TOEFL_JR'
        ? 'TOEFL Jr'
        : row.testType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('detail.levelTest.dialog.title', { test: testLabel })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.levelTest.dialog.date')}</Label>
            <Input
              type="date"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.levelTest.dialog.time')}</Label>
            <select
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.levelTest.dialog.teacher')}</Label>
            <AmaUserPicker
              value={amaUser}
              onChange={setAmaUser}
              levels={['MANAGER', 'MEMBER', 'VIEWER']}
              labelKey="csl:detail.levelTest.dialog.teacher"
            />
            <p className="text-[10px] text-secondary">
              {t('detail.levelTest.dialog.amaPickerHint')}
            </p>
          </div>
          <p className="text-[11px] text-secondary">
            {t('detail.levelTest.dialog.calHint')}
          </p>
          {save.isError && (
            <p className="text-xs text-red-600">
              {(save.error as { response?: { data?: { message?: string } } })?.response
                ?.data?.message ?? (save.error as Error).message}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !scheduledAt || !scheduledTime}
          >
            {save.isPending
              ? t('common:actions.saving')
              : t('detail.levelTest.dialog.saveAndCal')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
