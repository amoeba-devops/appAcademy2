import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes/router';
import { queryClient } from '@/lib/query-client';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import '@/i18n';
import '@/styles/globals.css';
import { setupPwa } from '@/lib/pwa';
import { PwaUpdateToast } from '@/components/pwa/pwa-update-toast';

// REQ-261018D — ACM 앱(PWA): 서비스 워커·설치 제안·새 버전 감지
setupPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <PwaUpdateToast />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
