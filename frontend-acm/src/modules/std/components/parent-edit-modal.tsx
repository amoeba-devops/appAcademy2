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
import {
  CountryCodeSelect,
  EMPTY_PARENT_EXTRA,
  ParentMessengerMemoFields,
} from './parent-extra-fields';
import { useUpdateParent, type ParentSummary } from '../hooks/use-parents';

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'mb-1 block text-xs text-secondary';

/**
 * REQ-260729-3 — 학부모 수정: 인라인 행 편집 → 모달 처리.
 * 기본정보(이름/관계/국가번호+전화/이메일/메신저/메모) + 포털 계정 패널.
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
    ...EMPTY_PARENT_EXTRA,
  });

  useEffect(() => {
    if (!parent) return;
    setForm({
      parName: parent.name,
      parRelation: parent.relation ?? '',
      parPhone: parent.phone ?? '',
      parEmail: parent.email ?? '',
      parCountryCode: parent.countryCode ?? '',
      parMessengerType: parent.messengerType ?? '',
      parMessengerId: parent.messengerId ?? '',
      parMemo: parent.memo ?? '',
    });
  }, [parent]);

  const save = async () => {
    if (!parent) return;
    await updateMut.mutateAsync({
      parName: form.parName,
      parRelation: form.parRelation || undefined,
      parPhone: form.parPhone || undefined,
      parEmail: form.parEmail || undefined,
      // 빈 값도 보내서 지울 수 있게 한다 (서버에서 '' → null).
      parCountryCode: form.parCountryCode,
      parMessengerType: form.parMessengerType,
      parMessengerId: form.parMessengerId,
      parMemo: form.parMemo,
    });
    onClose();
  };

  return (
    <Dialog open={!!parent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('parentList.editTitle', '학부모 정보 수정')}</DialogTitle>
        </DialogHeader>

        {parent && (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('field.parentEmail', '이메일')}</label>
                <input
                  type="email"
                  value={form.parEmail}
                  onChange={(e) => setForm({ ...form, parEmail: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('field.parentPhone', '전화번호')}</label>
                <div className="flex gap-2">
                  <CountryCodeSelect
                    value={form.parCountryCode ?? ''}
                    onChange={(v) => setForm({ ...form, parCountryCode: v })}
                    className={inputClass + ' w-28 shrink-0 px-2'}
                  />
                  <input
                    value={form.parPhone}
                    onChange={(e) => setForm({ ...form, parPhone: e.target.value })}
                    className={inputClass + ' min-w-0'}
                  />
                </div>
              </div>
              <ParentMessengerMemoFields
                value={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                inputClass={inputClass}
                labelClass={labelClass}
              />
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
