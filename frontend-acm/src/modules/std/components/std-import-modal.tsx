import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useImportStudents } from '../hooks/use-students';
import type { ImportResult } from '../types';

interface StdImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function StdImportModal({ open, onClose }: StdImportModalProps) {
  const { t } = useTranslation('std');
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const importMut = useImportStudents();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setSelectedFile(f);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    const res = await importMut.mutateAsync(selectedFile);
    setResult(res);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const handleDownloadTemplate = () => {
    window.open('/api/acm/std/students/template', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* 파일 선택 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-subtle)] p-8 text-center cursor-pointer hover:bg-[var(--gray-50)] transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={28} className="mb-2 text-secondary" />
            {selectedFile ? (
              <p className="text-sm font-medium text-primary">{selectedFile.name}</p>
            ) : (
              <>
                <p className="text-sm text-secondary">{t('import.dropHint')}</p>
                <p className="text-xs text-secondary mt-1">.xlsx 파일만 지원</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* 결과 표시 */}
          {result && (
            <div className="rounded-md bg-[var(--gray-50)] border border-[var(--border-subtle)] p-4 space-y-2">
              <p className="text-sm font-medium">
                {t('import.resultSuccess', { count: result.success })}
                {result.failed > 0 && (
                  <span className="ml-2 text-red-600">
                    {t('import.resultFailed', { count: result.failed })}
                  </span>
                )}
              </p>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((e) => (
                    <p key={e.row} className="text-xs text-red-600">
                      {t('import.rowError', { row: e.row })}: {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleDownloadTemplate}>
            {t('import.downloadTemplate')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {result ? t('common:actions.close') : t('common:actions.cancel')}
            </Button>
            {!result && (
              <Button
                type="button"
                onClick={handleImport}
                disabled={!selectedFile || importMut.isPending}
              >
                {importMut.isPending ? t('common:status.loading') : t('import.execute')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
