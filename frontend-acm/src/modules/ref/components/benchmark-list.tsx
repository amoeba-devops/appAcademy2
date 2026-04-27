import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { BenchmarkCreateDialog } from '@/modules/ref/components/benchmark-create-dialog';

interface BenchmarkGrade {
  id: string;
  sbmId: string;
  gradeLabel: string;
  gradeMin: number;
  gradeMax: number;
}

interface Benchmark {
  id: string;
  code: string;
  examType: 'MAP' | 'ISEE' | 'SSAT';
  levelLabel: string;
  versionNo: number;
  effectiveFrom: string;
  dataStatus: string;
  mapReadingScore?: string | null;
  mapMathScore?: string | null;
  generalPct?: string | null;
  premiumPrivatePct?: string | null;
  topBoardingPct?: string | null;
}

interface BenchmarkView {
  benchmark: Benchmark;
  grades: BenchmarkGrade[];
}

export function BenchmarkList() {
  const { t } = useTranslation(['ref', 'common']);
  const { data, isLoading } = useQuery({
    queryKey: ['ref', 'benchmarks'],
    queryFn: async () => {
      const res = await apiClient.get<BenchmarkView[]>('/acm/ref/score-benchmarks');
      return res.data;
    },
  });

  const fmt = (b: Benchmark) => {
    if (b.examType === 'MAP') {
      const r = b.mapReadingScore ?? '—';
      const m = b.mapMathScore ?? '—';
      return `R ${r} / M ${m}`;
    }
    const g = b.generalPct ?? '—';
    const p = b.premiumPrivatePct ?? '—';
    const tp = b.topBoardingPct ?? '—';
    return `Gen ${g} / Pre ${p} / Top ${tp}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('tabs.benchmarks')}</h2>
        <BenchmarkCreateDialog />
      </div>
      {isLoading && <p className="text-secondary">{t('common:status.loading')}</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="text-secondary py-12 text-center">{t('empty.benchmarks')}</p>
      )}
      {(data?.length ?? 0) > 0 && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-100)] text-secondary">
              <tr>
                <th className="text-left px-4 py-3">{t('table.code')}</th>
                <th className="text-left px-4 py-3">{t('table.examType')}</th>
                <th className="text-left px-4 py-3">{t('table.level')}</th>
                <th className="text-left px-4 py-3">Scores</th>
                <th className="text-left px-4 py-3">{t('form.grades')}</th>
                <th className="text-left px-4 py-3">{t('table.version')}</th>
                <th className="text-left px-4 py-3">{t('table.effectiveFrom')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((v) => (
                <tr
                  key={v.benchmark.id}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="px-4 py-3 font-mono text-xs">{v.benchmark.code}</td>
                  <td className="px-4 py-3">
                    {t(`sbmExamType.${v.benchmark.examType}`)}
                  </td>
                  <td className="px-4 py-3">{v.benchmark.levelLabel}</td>
                  <td className="px-4 py-3 text-xs">{fmt(v.benchmark)}</td>
                  <td className="px-4 py-3 text-xs">
                    {v.grades.map((g) => g.gradeLabel).join(', ')}
                  </td>
                  <td className="px-4 py-3">v{v.benchmark.versionNo}</td>
                  <td className="px-4 py-3">{v.benchmark.effectiveFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
