import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GuidelineList } from '@/modules/ref/components/guideline-list';
import { LevelTestList } from '@/modules/ref/components/level-test-list';
import { BenchmarkList } from '@/modules/ref/components/benchmark-list';

type Tab = 'guidelines' | 'levelTests' | 'benchmarks';

const TABS: Tab[] = ['guidelines', 'levelTests', 'benchmarks'];

export function ReferenceListPage() {
  const { t } = useTranslation('ref');
  const [tab, setTab] = useState<Tab>('guidelines');

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t('title')}</h1>
      <div className="border-b border-[var(--border-subtle)] mb-6 flex gap-1">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              'px-4 py-2 text-sm border-b-2 -mb-px transition-colors ' +
              (tab === k
                ? 'border-accent text-accent font-medium'
                : 'border-transparent text-secondary hover:text-primary')
            }
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'guidelines' && <GuidelineList />}
      {tab === 'levelTests' && <LevelTestList />}
      {tab === 'benchmarks' && <BenchmarkList />}
    </div>
  );
}
