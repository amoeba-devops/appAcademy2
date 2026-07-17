import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Paperclip } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import type { CalEventAttachment } from '../types';

/**
 * PLN-260718 P2 — calendar event attachment uploader + list (admin/teacher).
 * Backend-proxied multipart upload → S3; download streams back via blob.
 * Only rendered for an already-saved event (needs evtId).
 */

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_COUNT = 20;
// Broad allow-list for 교재/자료 (mirrors backend cal-event-attachment.service).
const ACCEPT = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.hwp',
  '.zip',
  '.txt',
].join(',');

interface Props {
  evtId: string;
  readOnly?: boolean;
}

export function CalEventAttachmentPanel({ evtId, readOnly }: Props) {
  const { t } = useTranslation(['cal', 'common']);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const listKey = ['cal', 'event-attachments', evtId];

  const { data: rows = [] } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const res = await apiClient.get<CalEventAttachment[]>(
        `/acm/cal/events/${evtId}/attachments`,
      );
      return res.data;
    },
    enabled: !!evtId,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      await apiClient.post(`/acm/cal/events/${evtId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
  });

  const delMut = useMutation({
    mutationFn: async (attId: string) => {
      await apiClient.delete(`/acm/cal/events/${evtId}/attachments/${attId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
  });

  function validate(file: File): string | null {
    if (file.size === 0) return t('attach.error.empty', '빈 파일은 업로드할 수 없습니다.');
    if (file.size > MAX_SIZE) return t('attach.error.size', { defaultValue: '파일은 20MB 이하만 가능합니다.' });
    if (rows.length >= MAX_COUNT)
      return t('attach.error.count', { defaultValue: '최대 {{max}}개까지 첨부할 수 있습니다.', max: MAX_COUNT });
    return null;
  }

  async function handleFiles(files: FileList | File[]): Promise<void> {
    setErrors({});
    setBusy(true);
    for (const f of Array.from(files)) {
      const v = validate(f);
      if (v) {
        setErrors((e) => ({ ...e, [f.name]: v }));
        continue;
      }
      try {
        await upload.mutateAsync(f);
      } catch (e) {
        const err = e as { response?: { data?: { message?: string; code?: string } } };
        setErrors((p) => ({
          ...p,
          [f.name]: err.response?.data?.message ?? err.response?.data?.code ?? 'Upload failed',
        }));
      }
    }
    setBusy(false);
  }

  async function download(attId: string, fallbackName: string): Promise<void> {
    try {
      const res = await apiClient.get<Blob>(
        `/acm/cal/events/${evtId}/attachments/${attId}/download`,
        { responseType: 'blob' },
      );
      const cd =
        (res.headers as Record<string, string | undefined> | undefined)?.[
          'content-disposition'
        ] ?? '';
      const match = /filename\*?=(?:UTF-8'')?([^";]+)/i.exec(cd);
      const filename = match ? decodeURIComponent(match[1]) : fallbackName;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      window.alert(err.response?.data?.message ?? 'Download failed');
    }
  }

  return (
    <fieldset className="space-y-2 rounded-md border border-[var(--border-subtle)] p-4">
      <legend className="px-1 text-xs font-semibold text-secondary">
        {t('attach.section', '첨부자료')}{' '}
        <span className="font-normal text-[11px]">({rows.length}/{MAX_COUNT})</span>
      </legend>

      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-center text-xs ${
            dragOver
              ? 'border-accent-500 bg-[var(--canvas-subtle)]'
              : 'border-[var(--border-subtle)] text-secondary hover:border-accent-500'
          }`}
        >
          <Paperclip size={14} />
          {busy
            ? t('common:actions.saving', '저장 중…')
            : t('attach.dropHint', '파일을 끌어다 놓거나 클릭하여 첨부 (≤20MB)')}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {Object.entries(errors).length > 0 && (
        <div className="grid gap-1 text-[11px] text-red-600">
          {Object.entries(errors).map(([name, err]) => (
            <div key={name}>
              <span className="font-medium">{name}</span>: {err}
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[11px] text-secondary">{t('attach.empty', '첨부된 자료가 없습니다.')}</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--canvas-subtle)] px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs">{r.filename}</span>
              <span className="text-[10px] text-secondary">
                {(Number(r.sizeBytes) / 1024).toFixed(0)} KB
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void download(r.id, r.filename)}
                className="h-7 px-2 text-xs"
              >
                {t('attach.download', '다운로드')}
              </Button>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(t('attach.confirmDelete', '이 첨부를 삭제할까요?'))) {
                      delMut.mutate(r.id);
                    }
                  }}
                  className="h-7 px-2 text-xs"
                  disabled={delMut.isPending}
                >
                  ✕
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
