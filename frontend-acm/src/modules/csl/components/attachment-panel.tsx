import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * REQ-260626 T-06 / ADR-008 — attachment uploader + list.
 *
 * Drag-drop (or click) → drives a 3-step flow against the backend:
 *   1. POST /:inq/attachments/presigned-upload   → { attId, presignedUrl }
 *   2. PUT to presignedUrl (direct to MinIO/S3)  → 200
 *   3. POST /:inq/attachments/:attId/confirm     → row marked active
 *
 * Backend validates size/mime/count + visibility on its side; this
 * component echoes the same caps so the user sees a clear error
 * before uploading 9 MB of a wrong-type file.
 *
 * `category` is fixed by the parent (TRANSCRIPT at intake; MATERIAL
 * at demo class). `refId` is optional (tcl_id for MATERIAL rows).
 */

type AttachmentCategory = 'TRANSCRIPT' | 'MATERIAL' | 'RESULT_PDF';
type AttachmentVisibility = 'STAFF_ONLY' | 'TEACHER_STUDENT';

interface AttachmentRow {
  id: string;
  category: AttachmentCategory;
  filename: string;
  mime: string;
  sizeBytes: string;
  visibility: AttachmentVisibility;
  uploadedBy: string | null;
  createdAt: string;
}

const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_COUNT = 10;

interface Props {
  inqId: string;
  category: AttachmentCategory;
  refId?: string | null;
  /** Disable the uploader (still shows the list). */
  readOnly?: boolean;
}

export function AttachmentPanel({ inqId, category, refId, readOnly }: Props) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const listKey = ['csl', 'attachments', inqId, category];

  const { data: rows = [] } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const res = await apiClient.get<AttachmentRow[]>(
        `/acm/csl/inquiries/${inqId}/attachments`,
        { params: { category } },
      );
      return res.data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      // FIX-260630 — single-step backend-proxied multipart upload.
      // (Previous presigned-PUT scheme blocked by Mixed Content because
      // MinIO is on a docker-internal hostname.)
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      if (refId) fd.append('refId', refId);
      await apiClient.post(`/acm/csl/inquiries/${inqId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const total = e.total;
          if (total) {
            setProgress((p) => ({ ...p, [file.name]: (e.loaded / total) * 100 }));
          }
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
  });

  function validate(file: File): string | null {
    if (file.size > MAX_SIZE) return t('detail.attachment.error.size', { max: '10MB' });
    if (file.size === 0) return t('detail.attachment.error.empty');
    if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
      return t('detail.attachment.error.mime');
    }
    if (rows.length >= MAX_COUNT) {
      return t('detail.attachment.error.count', { max: MAX_COUNT });
    }
    return null;
  }

  async function handleFiles(files: FileList | File[]): Promise<void> {
    setErrors({});
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
      } finally {
        setProgress((p) => {
          const next = { ...p };
          delete next[f.name];
          return next;
        });
      }
    }
  }

  const delMut = useMutation({
    mutationFn: async (attId: string) => {
      await apiClient.delete(`/acm/csl/inquiries/${inqId}/attachments/${attId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
  });

  async function download(attId: string, fallbackName: string): Promise<void> {
    try {
      // FIX-260630 — backend streams the file body directly (no presigned
      // URL). We fetch as blob + use Content-Disposition for the filename
      // when available, fallback to the row's filename.
      const res = await apiClient.get<Blob>(
        `/acm/csl/inquiries/${inqId}/attachments/${attId}/download`,
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
    <div className="grid gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] px-3 py-3">
      <Label className="text-xs">
        {t(`detail.attachment.category.${category}`)}{' '}
        <span className="text-[11px] text-secondary">
          ({rows.length}/{MAX_COUNT})
        </span>
      </Label>

      {/* Uploader */}
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
          className={`cursor-pointer rounded-md border border-dashed px-3 py-4 text-center text-xs ${
            dragOver
              ? 'border-primary bg-[var(--surface)]'
              : 'border-[var(--border-subtle)] text-secondary hover:border-primary'
          }`}
        >
          {t('detail.attachment.dropHint')}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ALLOWED_MIMES.join(',')}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* In-progress uploads */}
      {Object.entries(progress).length > 0 && (
        <div className="grid gap-1 text-[11px]">
          {Object.entries(progress).map(([name, pct]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="truncate flex-1">{name}</span>
              <span className="w-12 text-right text-secondary">{Math.round(pct)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation errors */}
      {Object.entries(errors).length > 0 && (
        <div className="grid gap-1 text-[11px] text-red-600">
          {Object.entries(errors).map(([name, err]) => (
            <div key={name}>
              <span className="font-medium">{name}</span>: {err}
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <p className="text-[11px] text-secondary">{t('detail.attachment.empty')}</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5"
            >
              <span className="text-xs flex-1 truncate">{r.filename}</span>
              <span className="text-[10px] text-secondary">
                {(Number(r.sizeBytes) / 1024).toFixed(0)} KB
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void download(r.id, r.filename)}
                className="h-7 text-xs px-2"
              >
                ↓
              </Button>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(t('detail.attachment.confirmDelete'))) {
                      delMut.mutate(r.id);
                    }
                  }}
                  className="h-7 text-xs px-2"
                  disabled={delMut.isPending}
                >
                  ✕
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
