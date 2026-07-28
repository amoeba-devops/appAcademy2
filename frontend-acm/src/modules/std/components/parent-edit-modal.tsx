import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PortalAccountPanel } from '@/modules/portal-admin/components/portal-account-panel';
import { useUpdateParent, type ParentSummary } from '../hooks/use-parents';

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'mb-1 block text-xs text-secondary';

/**
 * REQ-260729-3 — 학부모 수정: 인라인 행 편집 → 모달 처리.
 * 기본정보(이름/관계/전화/이메일) + 포털 계정 패널.
 */
export function ParentEditModal({
  parent,
  onClose,
}: {
  parent: ParentSummary | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('std');
  const updateMut = useUpdateParent(parent?.id ?? '');
  const [form, setForm] = useState({
    parName: '',
    parRelation: '',
    parPhone: '',
    parEmail: '',
  });

  useEffect(() => {
    if (!parent) return;
    setForm({
      parName: parent.name,
      parRelation: parent.relation ?? '',
      parPhone: parent.phone ?? '',
      parEmail: parent.email ?? '',
    });
  }, [parent]);

  const save = async () => {
    if (!parent) return;
    await updateMut.mutateAsync({
      parName: form.parName,
      parRelation: form.parRelation || undefined,
      parPhone: form.parPhone || undefined,
      parEmail: form.parEmail || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={!!parent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('parentList.editTitle', '학부모 정보 수정')}</DialogTitle>
        </DialogHeader>

        {parent && (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.parentName', '이름')} *</label>
                <input
                  value={form.parName}
                  onChange={(e) => setForm({ ...form, parName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.parentRelation', '관계')}</label>
                <input
                  value={form.parRelation}
                  onChange={(e) => setForm({ ...form, parRelation: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.parentPhone', '전화번호')}</label>
                <input
                  value={form.parPhone}
                  onChange={(e) => setForm({ ...form, parPhone: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.parentEmail', '이메일')}</label>
                <input
                  type="email"
                  value={form.parEmail}
                  onChange={(e) => setForm({ ...form, parEmail: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <PortalAccountPanel kind="PARENT" refId={parent.id} />
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common:actions.cancel', '취소')}
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={updateMut.isPending || !form.parName.trim()}
          >
            {t('common:actions.save', '저장')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
