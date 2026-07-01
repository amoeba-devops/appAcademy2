import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AmaUserPicker } from '@/components/common/ama-user-picker';
import type { AmaPlatformUser } from '@/lib/ama-user-api';
import {
  uploadTeacherAttachment,
  useCreateTeacher,
  useDeleteTeacher,
  useLockTeacherAccount,
  useResetTeacherPassword,
  useUnlockTeacherAccount,
  useUpdateTeacher,
} from '../hooks/use-teachers';
import { TCH_SUBJECTS, type TchSubject, type TeacherDetail } from '../types';
import { useAuthStore } from '@/stores/auth.store';
import { TchAttachmentPanel } from './tch-attachment-panel';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const fmtSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: TeacherDetail;
  /**
   * REQ-260629 FR-301 — pre-selected AMA user from /admin/tch list page's
   * AmaDirectorySection. When set, the form opens in create mode with the
   * AMA picker pre-populated (name/email locked, amaUserId carried through).
   */
  prefillFromAma?: import('@/lib/ama-user-api').AmaPlatformUser | null;
}

type FormValues = {
  tchName: string;
  tchEnglishName: string;
  tchEmail: string;
  tchPhone: string;
  tchBirthDate: string;
  tchMemo: string;
  tchStatus: string;
  // REQ-260510 신규 필드
  tchIsInstructor: boolean;
  tchEmploymentType: 'FULL_TIME' | 'PART_TIME';
  tchHiredAt: string;
  tchAttendanceNo: string;
  // 신규 등록 시만
  tchCreateAccount: boolean;
  tchPassword: string;
  tchPasswordConfirm: string;
};

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

export function TchFormModal({ open, onClose, initial, prefillFromAma }: Props) {
  const { t } = useTranslation('tch');
  const isEdit = !!initial;

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      tchName: '',
      tchEnglishName: '',
      tchEmail: '',
      tchPhone: '',
      tchBirthDate: '',
      tchMemo: '',
      tchStatus: 'ACTIVE',
      tchIsInstructor: true,
      tchEmploymentType: 'FULL_TIME',
      tchHiredAt: '',
      tchAttendanceNo: '',
      tchCreateAccount: false,
      tchPassword: '',
      tchPasswordConfirm: '',
    },
  });

  const [subjects, setSubjects] = useState<TchSubject[]>([]);
  const [error, setError] = useState<string | null>(null);
  // FIX-260512: staged file uploads for create mode (uploaded after teacher is created)
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const stagedInputRef = useRef<HTMLInputElement | null>(null);

  // REQ-260604 FR-3 — AMA-picker state. `amaUser` holds the selected directory
  // entry (or null). `manualMode` lets the operator bypass the picker when
  // AMA is unreachable (AC-3-5). Only relevant on create — edit reuses
  // existing teacher.name/email.
  const [amaUser, setAmaUser] = useState<AmaPlatformUser | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Sync defaults when opening for edit/create.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setStagedFiles([]);
    // REQ-260629 — when opened with a prefill from the list-page AMA section,
    // seed the picker so the operator just clicks "save".
    setAmaUser(prefillFromAma ?? null);
    setManualMode(false);
    if (initial) {
      reset({
        tchName: initial.name,
        tchEnglishName: initial.englishName ?? '',
        tchEmail: initial.email,
        tchPhone: initial.phone ?? '',
        tchBirthDate: initial.birthDate ?? '',
        tchMemo: initial.memo ?? '',
        tchStatus: initial.status,
        tchIsInstructor: initial.isInstructor,
        tchEmploymentType: initial.employmentType,
        tchHiredAt: initial.hiredAt ?? '',
        tchAttendanceNo: initial.attendanceNo ?? '',
        tchCreateAccount: false,
        tchPassword: '',
        tchPasswordConfirm: '',
      });
      setSubjects(initial.subjects ?? []);
    } else {
      reset({
        tchName: prefillFromAma?.name ?? '',
        tchEnglishName: '',
        tchEmail: prefillFromAma?.email ?? '',
        tchPhone: '',
        tchBirthDate: '',
        tchMemo: '',
        tchStatus: 'ACTIVE',
        tchIsInstructor: true,
        tchEmploymentType: 'FULL_TIME',
        tchHiredAt: '',
        tchAttendanceNo: '',
        tchCreateAccount: false,
        tchPassword: '',
        tchPasswordConfirm: '',
      });
      setSubjects([]);
    }
  }, [open, initial, prefillFromAma, reset]);

  const createMut = useCreateTeacher();
  const updateMut = useUpdateTeacher(initial?.id ?? '');
  const deleteMut = useDeleteTeacher();
  const resetPwMut = useResetTeacherPassword(initial?.id ?? '');
  const lockMut = useLockTeacherAccount();
  const unlockMut = useUnlockTeacherAccount();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isLoading =
    createMut.isPending ||
    updateMut.isPending ||
    deleteMut.isPending ||
    resetPwMut.isPending ||
    lockMut.isPending ||
    unlockMut.isPending;

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
      tchIsInstructor: !!values.tchIsInstructor,
      tchEmploymentType: values.tchEmploymentType,
    };
    if (values.tchEnglishName) dto.tchEnglishName = values.tchEnglishName;
    if (values.tchPhone) dto.tchPhone = values.tchPhone;
    if (values.tchBirthDate) dto.tchBirthDate = values.tchBirthDate;
    if (values.tchMemo) dto.tchMemo = values.tchMemo;
    if (values.tchHiredAt) dto.tchHiredAt = values.tchHiredAt;
    if (values.tchAttendanceNo) dto.tchAttendanceNo = values.tchAttendanceNo;
    // REQ-260604 FR-3 / REQ-260629 — propagate AMA picker selection to backend.
    //   - On create: linkage carries through.
    //   - On edit: backfill amaUserId when the operator routed here from the
    //     AmaDirectorySection's "email match" branch (existing teacher row
    //     without amaUserId) — UpdateTeacherDto.tchAmaUserId now accepts it.
    if (amaUser && !manualMode) {
      dto.tchAmaUserId = amaUser.userId;
    }

    try {
      if (isEdit) {
        await updateMut.mutateAsync(dto);
      } else {
        if (values.tchCreateAccount) {
          dto.tchCreateAccount = true;
          dto.tchPassword = values.tchPassword;
        }
        const created = await createMut.mutateAsync(dto);
        // FIX-260512: upload staged files sequentially after teacher is created
        if (stagedFiles.length > 0 && created?.id) {
          for (const f of stagedFiles) {
            try {
              await uploadTeacherAttachment(created.id, f);
            } catch (uploadErr) {
              const msg = (uploadErr as { response?: { data?: { message?: string } } })
                ?.response?.data?.message;
              setError(
                t('attachment.error.uploadFailed', '첨부파일 업로드 실패: {{name}} ({{msg}})', {
                  name: f.name,
                  msg: msg ?? 'unknown',
                }),
              );
              // continue with remaining files
            }
          }
        }
      }
      onClose();
    } catch (e) {
      // REQ-260630 — backend returns structured 409 for name/englishName/email
      // duplicates. Render a per-field Korean message; fall back to the
      // raw `message` for other errors.
      const err = e as {
        response?: {
          data?: {
            code?: string;
            field?: string;
            value?: string;
            message?: string;
          };
        };
      };
      const code = err.response?.data?.code;
      const value = err.response?.data?.value ?? '';
      if (code === 'NAME_DUPLICATE') {
        setError(t('error.nameDuplicate', { value }));
      } else if (code === 'ENGLISH_NAME_DUPLICATE') {
        setError(t('error.englishNameDuplicate', { value }));
      } else if (code === 'EMAIL_DUPLICATE') {
        setError(t('error.emailDuplicate', { value }));
      } else {
        setError(err.response?.data?.message ?? t('common:status.error'));
      }
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
          {/* REQ-260604 FR-3 — AMA directory picker (create mode only). The
              picker auto-fills tchName + tchEmail when a member is selected;
              if AMA is unreachable the operator clicks "manual mode" and the
              original inputs are shown unchanged. */}
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
                    setValue('tchName', u.name);
                    setValue('tchEmail', u.email);
                  } else {
                    setValue('tchName', '');
                    setValue('tchEmail', '');
                  }
                }}
                onManualMode={() => setManualMode(true)}
                labelKey="tch:field.amaUser"
                required
              />
            </fieldset>
          )}

          {/* 기본 정보 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('form.sectionBasic')}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.name')} *</label>
                <input
                  {...register('tchName', { required: true })}
                  className={inputClass}
                  // When the picker controls the name, lock the input so the
                  // operator can't desync them. Manual mode unlocks it.
                  disabled={!isEdit && !manualMode && !!amaUser}
                />
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
                  disabled={isEdit || (!manualMode && !!amaUser)}
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
                  <option value="LEAVE">{t('status.LEAVE')}</option>
                  <option value="RESIGNED">{t('status.RESIGNED')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('field.employmentType')}</label>
                <select {...register('tchEmploymentType')} className={inputClass}>
                  <option value="FULL_TIME">{t('employmentType.FULL_TIME')}</option>
                  <option value="PART_TIME">{t('employmentType.PART_TIME')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('field.hiredAt')}</label>
                <input type="date" {...register('tchHiredAt')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.attendanceNo')}</label>
                <input
                  {...register('tchAttendanceNo')}
                  className={inputClass}
                  maxLength={50}
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register('tchIsInstructor')} />
                  {t('field.isInstructor')}
                </label>
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
            <fieldset className="rounded-md border border-rose-200 bg-rose-50/40 p-4 space-y-3">
              <legend className="text-xs font-semibold text-rose-800 px-1">
                {t('form.sectionAccountLock')}
              </legend>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">
                    {initial.accountLockedAt
                      ? t('accountState.LOCKED')
                      : t('accountState.UNLOCKED')}
                  </span>
                  {initial.accountLockedAt && (
                    <span className="ml-2 text-xs text-secondary">
                      ({new Date(initial.accountLockedAt).toLocaleString()})
                    </span>
                  )}
                </div>
                {initial.userId === currentUserId ? (
                  <span className="text-xs text-secondary">{t('hint.cannotLockSelf')}</span>
                ) : initial.accountLockedAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={async () => {
                      try {
                        await unlockMut.mutateAsync(initial.id);
                      } catch (e) {
                        const msg = (e as { response?: { data?: { message?: string } } })
                          ?.response?.data?.message;
                        setError(msg ?? t('common:status.error'));
                      }
                    }}
                  >
                    {t('actions.unlock')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={async () => {
                      if (!confirm(t('confirm.lock'))) return;
                      try {
                        await lockMut.mutateAsync(initial.id);
                      } catch (e) {
                        const msg = (e as { response?: { data?: { message?: string } } })
                          ?.response?.data?.message;
                        setError(msg ?? t('common:status.error'));
                      }
                    }}
                  >
                    {t('actions.lock')}
                  </Button>
                )}
              </div>
            </fieldset>
          )}

          {isEdit && initial && (
            <TchAttachmentPanel teacherId={initial.id} />
          )}

          {/* FIX-260512: staged attachments for create mode */}
          {!isEdit && (
            <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
              <legend className="text-xs font-semibold text-secondary px-1">
                {t('attachment.section', '첨부파일')}
              </legend>
              <div className="flex items-center justify-between">
                <p className="text-xs text-secondary">
                  {t('attachment.hint', 'PDF/JPEG/PNG, 개별 최대 10MB. 교사 등록 후 자동 업로드됩니다.')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => stagedInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload size={14} className="mr-1" />
                  {t('attachment.actions.add', '파일 추가')}
                </Button>
                <input
                  ref={stagedInputRef}
                  type="file"
                  multiple
                  accept=".pdf,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    const accepted: File[] = [];
                    for (const f of files) {
                      if (!ALLOWED_MIME.includes(f.type)) {
                        setError(t('attachment.error.mime', '허용되지 않은 파일 형식: {{name}}', { name: f.name }));
                        continue;
                      }
                      if (f.size > MAX_BYTES) {
                        setError(t('attachment.error.size', '파일 크기 초과(최대 10MB): {{name}}', { name: f.name }));
                        continue;
                      }
                      accepted.push(f);
                    }
                    if (accepted.length > 0) {
                      setError(null);
                      setStagedFiles((prev) => [...prev, ...accepted]);
                    }
                  }}
                />
              </div>
              {stagedFiles.length === 0 ? (
                <p className="text-secondary py-2 text-center text-xs">
                  {t('attachment.staged.empty', '추가된 파일이 없습니다')}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {stagedFiles.map((f, idx) => (
                    <li
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="text-xs text-secondary">
                          {f.type || 'unknown'} · {fmtSize(f.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={isLoading}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </li>
                  ))}
                </ul>
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
