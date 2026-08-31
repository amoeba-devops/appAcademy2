import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  downloadTeacherAttachment,
  useDeleteTeacherAttachment,
  useTeacherAttachments,
  useUploadTeacherAttachment,
} from '../hooks/use-teachers';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const fmtSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

interface Props {
  teacherId: string;
}

export function TchAttachmentPanel({ teacherId }: Props) {
  const { t } = useTranslation('tch');
  // AMA iframe 임베드에서는 window.confirm이 표시되지 않음 — 인앱 모달 사용 (REQ-260831)
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: items, isLoading } = useTeacherAttachments(teacherId);
  const uploadMut = useUploadTeacherAttachment(teacherId);
  const deleteMut = useDeleteTeacherAttachment(teacherId);

  const onPick = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(t('attachment.error.mime'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('attachment.error.size'));
      return;
    }
    try {
      await uploadMut.mutateAsync(file);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const onDelete = async (attId: string) => {
    const ok = await confirm({
      title: t('attachment.confirm.delete'),
      description: t('common:confirm.deleteDescription'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(attId);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  return (
    <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
      <legend className="text-xs font-semibold text-secondary px-1">
        {t('attachment.section')}
      </legend>

      <div className="flex items-center justify-between">
        <p className="text-xs text-secondary">{t('attachment.hint')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPick}
          disabled={uploadMut.isPending}
        >
          <Upload size={14} className="mr-1" />
          {uploadMut.isPending ? t('common:actions.saving') : t('attachment.actions.upload')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-secondary py-4 text-center text-sm">
          {t('common:status.loading')}
        </p>
      ) : !items || items.length === 0 ? (
        <p className="text-secondary py-4 text-center text-xs">{t('attachment.empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.originalName}</p>
                <p className="text-xs text-secondary">
                  {a.mime} · {fmtSize(a.sizeBytes)} ·{' '}
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadTeacherAttachment(teacherId, a.id, a.originalName)
                  }
                >
                  <Download size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(a.id)}
                  disabled={deleteMut.isPending}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
