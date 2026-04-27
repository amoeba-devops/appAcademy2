'use client';

import { useTranslation } from 'react-i18next';
import { useNotificationLog } from '@/hooks/use-notifications';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw } from 'lucide-react';

interface Props {
  id: number;
  onClose: () => void;
  onResend: (id: number) => void | Promise<void>;
}

export function NotificationLogDetailModal({ id, onClose, onResend }: Props) {
  const { t } = useTranslation('admin');
  const { data: log, isLoading } = useNotificationLog(id);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('notifications.detail.title', '발송 이력 #{{id}}', { id })}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !log ? (
          <div className="text-center text-muted-foreground py-6">
            {t('common.loading', '불러오는 중...')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label={t('notifications.col.event', '이벤트')} value={log.event} />
              <Field
                label={t('notifications.col.status', '상태')}
                value={<Badge>{log.status}</Badge>}
              />
              <Field label={t('notifications.col.recipient', '수신자')} value={log.recipient} mono />
              <Field label={t('notifications.col.channel', '채널')} value={log.channel} />
              <Field label={t('notifications.col.attempts', '시도')} value={String(log.attempts)} />
              <Field
                label={t('notifications.col.sentAt', '발송시각')}
                value={log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}
              />
              <Field
                label={t('notifications.detail.subject', '대상')}
                value={
                  log.subjectKind && log.subjectId
                    ? `${log.subjectKind}#${log.subjectId}`
                    : '—'
                }
              />
              <Field
                label={t('notifications.detail.providerMsgId', '프로바이더 MsgID')}
                value={log.providerMsgId ?? '—'}
                mono
              />
            </div>

            {log.errorCode && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-xs font-medium text-destructive">
                  {log.errorCode}
                </div>
                <div className="text-sm">{log.errorMessage}</div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t('notifications.detail.body', '본문')}
              </div>
              <pre className="rounded-md border bg-muted p-3 text-sm whitespace-pre-wrap">
                {log.body ?? '—'}
              </pre>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t('notifications.detail.variables', '변수')}
              </div>
              <pre className="rounded-md border bg-muted p-3 text-xs font-mono">
                {JSON.stringify(log.variables ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter>
          {log && log.status !== 'SENT' && (
            <Button onClick={() => void onResend(log.id)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('notifications.action.resend', '재발송')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t('common.close', '닫기')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-xs' : 'text-sm'}>{value}</div>
    </div>
  );
}
