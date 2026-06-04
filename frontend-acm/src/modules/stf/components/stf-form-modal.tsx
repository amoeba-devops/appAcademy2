import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCreateStaff,
  useDeleteStaff,
  useResetStaffPassword,
  useUpdateStaff,
} from '../hooks/use-staff';
import type { StaffDetail } from '../types';
import { AmaUserPicker } from '@/components/common/ama-user-picker';
import type { AmaPlatformUser } from '@/lib/ama-user-api';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: StaffDetail;
}

type FormValues = {
  stfName: string;
  stfEnglishName: string;
  stfEmail: string;
  stfPhone: string;
  stfPosition: string;
  stfDepartment: string;
  stfHiredAt: string;
  stfMemo: string;
  stfStatus: string;
  stfCreateAccount: boolean;
  stfPassword: string;
  stfPasswordConfirm: string;
};

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

export function StfFormModal({ open, onClose, initial }: Props) {
  const { t } = useTranslation('stf');
  const isEdit = !!initial;
  const [error, setError] = useState<string | null>(null);
  // REQ-260604 FR-4 — see TchFormModal for the rationale on amaUser + manualMode.
  const [amaUser, setAmaUser] = useState<AmaPlatformUser | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      stfName: '',
      stfEnglishName: '',
      stfEmail: '',
      stfPhone: '',
      stfPosition: '',
      stfDepartment: '',
      stfHiredAt: '',
      stfMemo: '',
      stfStatus: 'ACTIVE',
      stfCreateAccount: false,
      stfPassword: '',
      stfPasswordConfirm: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAmaUser(null);
    setManualMode(false);
    if (initial) {
      reset({
        stfName: initial.name,
        stfEnglishName: initial.englishName ?? '',
        stfEmail: initial.email,
        stfPhone: initial.phone ?? '',
        stfPosition: initial.position ?? '',
        stfDepartment: initial.department ?? '',
        stfHiredAt: initial.hiredAt ?? '',
        stfMemo: initial.memo ?? '',
        stfStatus: initial.status,
        stfCreateAccount: false,
        stfPassword: '',
        stfPasswordConfirm: '',
      });
    } else {
      reset();
    }
  }, [open, initial, reset]);

  const createMut = useCreateStaff();
  const updateMut = useUpdateStaff(initial?.id ?? '');
  const deleteMut = useDeleteStaff();
  const resetPwMut = useResetStaffPassword(initial?.id ?? '');
  const isLoading =
    createMut.isPending || updateMut.isPending || deleteMut.isPending || resetPwMut.isPending;

  const wantsAccount = watch('stfCreateAccount');

  const validatePassword = (pw: string, confirm: string): string | null => {
    if (!pw || pw.length < 8) return t('error.passwordShort');
    if (pw !== confirm) return t('error.passwordMismatch');
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return t('error.passwordComplexity');
    return null;
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!isEdit && values.stfCreateAccount) {
      const pwErr = validatePassword(values.stfPassword, values.stfPasswordConfirm);
      if (pwErr) { setError(pwErr); return; }
    }

    const dto: Record<string, unknown> = {
      stfName: values.stfName,
      stfEmail: values.stfEmail,
      stfStatus: values.stfStatus,
    };
    if (values.stfEnglishName) dto.stfEnglishName = values.stfEnglishName;
    if (values.stfPhone) dto.stfPhone = values.stfPhone;
    if (values.stfPosition) dto.stfPosition = values.stfPosition;
    if (values.stfDepartment) dto.stfDepartment = values.stfDepartment;
    if (values.stfHiredAt) dto.stfHiredAt = values.stfHiredAt;
    if (values.stfMemo) dto.stfMemo = values.stfMemo;
    // REQ-260604 FR-4 — propagate AMA picker selection to backend.
    if (!isEdit && amaUser && !manualMode) {
      dto.stfAmaUserId = amaUser.userId;
    }

    try {
      if (isEdit) {
        await updateMut.mutateAsync(dto);
      } else {
        if (values.stfCreateAccount) {
          dto.stfCreateAccount = true;
          dto.stfPassword = values.stfPassword;
        }
        await createMut.mutateAsync(dto);
      }
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const onResetPassword = async () => {
    const v = watch();
    const pwErr = validatePassword(v.stfPassword, v.stfPasswordConfirm);
    if (pwErr) { setError(pwErr); return; }
    try {
      await resetPwMut.mutateAsync(v.stfPassword);
      reset({ ...v, stfPassword: '', stfPasswordConfirm: '' });
      alert(t('toast.passwordReset'));
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm(t('confirm.delete'))) return;
    try {
      await deleteMut.mutateAsync(initial.id);
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.titleEdit') : t('form.titleCreate')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {/* REQ-260604 FR-4 — AMA directory picker (create mode only). */}
          {!isEdit && !manualMode && (
            <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
              <legend className="text-xs font-semibold text-secondary px-1">
                {t('form.sectionAmaPicker', { defaultValue: 'AMA directory' })}
              </legend>
              <AmaUserPicker
                value={amaUser}
                levels={['MANAGER', 'MEMBER', 'VIEWER']}
                onChange={(u) => {
                  setAmaUser(u);
                  if (u) {
                    setValue('stfName', u.name);
                    setValue('stfEmail', u.email);
                  } else {
                    setValue('stfName', '');
                    setValue('stfEmail', '');
                  }
                }}
                onManualMode={() => setManualMode(true)}
                labelKey="stf:field.amaUser"
                required
              />
            </fieldset>
          )}

          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('form.sectionBasic')}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.name')} *</label>
                <input
                  {...register('stfName', { required: true })}
                  className={inputClass}
                  disabled={!isEdit && !manualMode && !!amaUser}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.englishName')}</label>
                <input {...register('stfEnglishName')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.email')} *</label>
                <input
                  type="email"
                  {...register('stfEmail', { required: true })}
                  className={inputClass}
                  disabled={isEdit || (!manualMode && !!amaUser)}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.phone')}</label>
                <input {...register('stfPhone')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.position')}</label>
                <input {...register('stfPosition')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.department')}</label>
                <input {...register('stfDepartment')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.hiredAt')}</label>
                <input type="date" {...register('stfHiredAt')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.status')}</label>
                <select {...register('stfStatus')} className={inputClass}>
                  <option value="ACTIVE">{t('status.ACTIVE')}</option>
                  <option value="INACTIVE">{t('status.INACTIVE')}</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('field.memo')}
            </legend>
            <textarea {...register('stfMemo')} rows={2} className={inputClass + ' h-auto py-2'} />
          </fieldset>

          {!isEdit && (
            <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
              <legend className="text-xs font-semibold text-secondary px-1">
                {t('form.sectionAccount')}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('stfCreateAccount')} />
                {t('field.createAccount')}
              </label>
              {wantsAccount && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t('field.password')} *</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      {...register('stfPassword')}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('field.passwordConfirm')} *</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      {...register('stfPasswordConfirm')}
                      className={inputClass}
                    />
                  </div>
                  <p className="col-span-2 text-xs text-secondary">{t('hint.passwordPolicy')}</p>
                </div>
              )}
            </fieldset>
          )}

          {isEdit && initial?.hasAccount && (
            <fieldset className="rounded-md border border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <legend className="text-xs font-semibold text-amber-800 px-1">
                {t('form.sectionResetPassword')}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t('field.newPassword')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register('stfPassword')}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('field.passwordConfirm')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register('stfPasswordConfirm')}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onResetPassword}
                  disabled={isLoading}
                >
                  {t('actions.resetPassword')}
                </Button>
              </div>
            </fieldset>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter className="flex justify-between">
            <div>
              {isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  disabled={isLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {t('common:actions.delete')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('common:actions.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? t('common:actions.saving') : t('common:actions.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
