import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function FilePreviewDialog({
  open,
  onOpenChange,
  title,
  src,
  mime,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  src: string | null;
  mime: string | null;
}) {
  const { t } = useTranslation('csl');
  const isImage = !!mime && mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="h-full min-h-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)]">
          {!src ? (
            <div className="flex h-full items-center justify-center text-sm text-secondary">
              {t('filePreview.loading')}
            </div>
          ) : isImage ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              <img
                src={src}
                alt={title}
                className="max-h-full w-auto max-w-full object-contain"
              />
            </div>
          ) : isPdf ? (
            <iframe title={title} src={src} className="h-full w-full rounded-md" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-secondary">
              {t('filePreview.unsupported')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
