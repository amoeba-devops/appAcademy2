import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

type Resolver = (value: boolean) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [state, setState] = useState<{ options: ConfirmOptions; resolver: Resolver } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolver: resolve });
    });
  }, []);

  const close = (result: boolean) => {
    if (state) {
      state.resolver(result);
      setState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => { if (!o) close(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{state?.options.title}</DialogTitle>
            {state?.options.description && (
              <DialogDescription>{state.options.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              {state?.options.cancelLabel ?? t('confirm.cancel')}
            </Button>
            <Button
              variant={state?.options.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={() => close(true)}
            >
              {state?.options.confirmLabel ?? t('confirm.ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx.confirm;
}
