import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EnrollmentPanel } from '../src/modules/csl/components/enrollment-panel';
import { apiClient } from '../src/lib/api-client';
import i18n from '../src/i18n';
import '../src/styles/globals.css';
void i18n.changeLanguage('ko');
let record: Record<string, unknown> = {
  paymentAmount: '1234567',
  tuitionAmount: '2000000',
  classMinutes: 1200,
  tuitionPaid: false,
};
apiClient.defaults.adapter = async (config) => {
  if (config.method === 'put') {
    record = { ...record, ...JSON.parse(config.data) };
    document.querySelector('output')!.textContent = config.data;
  }
  return {
    data: {
      success: true,
      data: config.url?.endsWith('/enrollment') ? record : [],
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
};
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <MemoryRouter>
      <main className="mx-auto max-w-3xl p-8">
        <EnrollmentPanel
          inqId="fixture"
          currentStage={
            location.search.includes('counsel')
              ? 'ENROLLMENT_COUNSELING'
              : 'PAYMENT'
          }
        />
        <output />
      </main>
    </MemoryRouter>
  </QueryClientProvider>,
);
