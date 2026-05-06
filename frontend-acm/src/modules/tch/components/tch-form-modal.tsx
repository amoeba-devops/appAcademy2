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
  useCreateTeacher,
  useDeleteTeacher,
  useResetTeacherPassword,
  useUpdateTeacher,
} from '../hooks/use-teachers';
import { TCH_SUBJECTS, type TchSubject, type TeacherDetail } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: TeacherDetail;
}

type FormValues = {
  tchName: string;
  tchEnglishName: string;
  tchEmail: string;
  tchPhone: string;
  tchBirthDate: string;
  tchMemo: string;
  tchStatus: string;
  // 신규 등록 시만
  tchCreateAccount: boolean;
  tchPassword: string;
  tchPasswordConfirm: string;
};

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

export function TchFormModal({ open, onClose, initial }: Props) {
  const { t } = useTranslation('tch');
  const isEdit = !!initial;

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      tchName: '',
      tchEnglishName: '',
      tchEmail: '',
      tchPhone: '',
      tchBirthDate: '',
      tchMemo: '',
      tchStatus: 'ACTIVE',
      tchCreateAccount: false,
      tchPassword: '',
      tchPasswordConfirm: '',
    },
  });

  const [subjects, setSubjects] = useState<TchSubject[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sync defaults when opening for edit/create.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      reset({
        tchName: initial.name,
        tchEnglishName: initial.englishName ?? '',
        tchEmail: initial.email,
        tchPhone: initial.phone ?? '',
        tchBirthDate: initial.birthDate ?? '',
        tchMemo: initial.memo ?? '',
        tchStatus: initial.status,
        tchCreateAccount: false,
        tchPassword: '',
        tchPasswordConfirm: '',
      });
      setSubjects(initial.subjects ?? []);
    } else {
      reset({
        tchName: '',
        tchEnglishName: '',
        tchEmail: '',
        tchPhone: '',
        tchBirthDate: '',
        tchMemo: '',
        tchStatus: 'ACTIVE',
        tchCreateAccount: false,
        tchPassword: '',
        tchPasswordConfirm: '',
      });
      setSubjects([]);
    }
  }, [open, initial, reset]);

  const createMut = useCreateTeacher();
  const updateMut = useUpdateTeacher(initial?.id ?? '');
  const deleteMut = useDeleteTeacher();
  const resetPwMut = useResetTeacherPassword(initial?.id ?? '');
  const isLoading =
    createMut.isPending || updateMut.isPending || deleteMut.isPending || resetPwMut.isPending;

  const wantsAccount = watch('tchCreateAccount');

  const toggleSubject = (s: TchSubject) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!isEdit && values.tchCreateAccount) {
      if (!values.tchPassword || values.tchPassword.length < 8) {
        setError(t('error.passwordShort'));
        return;
      }
      if (values.tchPassword !== values.tchPasswordConfirm) {
        setError(t('error.passwordMismatch'));
        return;
      }
      if (!/[A-Za-z]/.test(values.tchPassword) || !/[0-9]/.test(values.tchPassword)) {
        setError(t('error.passwordComplexity'));
        return;
      }
    }

    const dto: Record<string, unknown> = {
      tchName: values.tchName,
      tchEmail: values.tchEmail,
      tchSubjects: subjects,
      tchStatus: values.tchStatus,
    };
    if (values.tchEnglishName) dto.tchEnglishName = values.tchEnglishName;
    if (values.tchPhone) dto.tchPhone = values.tchPhone;
    if (values.tchBirthDate) dto.tchBirthDate = values.tchBirthDate;
    if (values.tchMemo) dto.tchMemo = values.tchMemo;

    try {
      if (isEdit) {
        await updateMut.mutateAsync(dto);
      } else {
        if (values.tchCreateAccount) {
          dto.tchCreateAccount = true;
          dto.tchPassword = values.tchPassword;
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
    setError(null);
    const v = watch();
    if (!v.tchPassword || v.tchPassword.length < 8) {
      setError(t('error.passwordShort'));
      return;
    }
    if (v.tchPassword !== v.tchPasswordConfirm) {
      setError(t('error.passwordMismatch'));
      return;
    }
    if (!/[A-Za-z]/.test(v.tchPassword) || !/[0-9]/.test(v.tchPassword)) {
      setError(t('error.passwordComplexity'));
      return;
    }
    try {
      await resetPwMut.mutateAsync(v.tchPassword);
      reset({ ...v, tchPassword: '', tchPasswordConfirm: '' });
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
          {/* 기본 정보 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('form.sectionBasic')}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.name')} *</label>
                <input {...register('tchName', { required: true })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.englishName')}</label>
                <input {...register('tchEnglishName')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.email')} *</label>
                <input
                  type="email"
                  {...register('tchEmail', { required: true })}
                  className={inputClass}
                  disabled={isEdit}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.phone')}</label>
                <input {...register('tchPhone')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.birthDate')}</label>
                <input type="date" {...register('tchBirthDate')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.status')}</label>
                <select {...register('tchStatus')} className={inputClass}>
                  <option value="ACTIVE">{t('status.ACTIVE')}</option>
                  <option value="INACTIVE">{t('status.INACTIVE')}</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* 담당 과목 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('form.sectionSubjects')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {TCH_SUBJECTS.map((s) => {
                const selected = subjects.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className={
                      selected
                        ? 'rounded-full border border-accent-500 bg-accent-50 px-3 py-1 text-xs text-accent-700'
                        : 'rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-secondary hover:bg-[var(--gray-50)]'
                    }
                  >
                    {t(`subject.${s}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 메모 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('field.memo')}
            </legend>
            <textarea {...register('tchMemo')} rows={2} className={inputClass + ' h-auto py-2'} />
          </fieldset>

          {/* 로그인 계정 (등록 시) / 비밀번호 재설정 (수정 시) */}
          {!isEdit && (
            <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
              <legend className="text-xs font-semibold text-secondary px-1">
                {t('form.sectionAccount')}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('tchCreateAccount')} />
                {t('field.createAccount')}
              </label>
              {wantsAccount && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t('field.password')} *</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      {...register('tchPassword')}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('field.passwordConfirm')} *</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      {...register('tchPasswordConfirm')}
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
                    {...register('tchPassword')}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('field.passwordConfirm')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register('tchPasswordConfirm')}
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
