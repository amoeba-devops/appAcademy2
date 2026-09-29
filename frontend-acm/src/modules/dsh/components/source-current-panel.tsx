import { useState } from 'react';
import { LifecycleDetails } from './lifecycle-details';
import { DualValue } from './operating-panel';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import type { CurrentSourceSnapshot } from '../types/source-current';

/** Current headcounts must never be presented as historical period results. */
export function SourceCurrentPanel() {
  const { t, i18n } = useTranslation('dsh');
  const [detail,setDetail]=useState<string|null>(null);
  const user = useAuthStore(s => s.user);
  const query = useQuery({
    queryKey: ['dsh', 'source-current', user?.entId, user?.id],
    enabled: !!user?.entId,
    queryFn: async () => (await apiClient.get<CurrentSourceSnapshot>('/acm/dsh/source-current')).data,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const metrics = ['activeStudents', 'activeTeachers', 'assignedStudents', 'assignedTeachers'] as const;
  const data = query.data;
  return (
    <section className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 mb-4" data-testid="dsh-source-current">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="font-semibold text-sm">{t('sourceCurrent.title')}</h2>
        <button type="button" className="text-xs text-secondary underline" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('sourceCurrent.refresh')}</button>
      </div>
      <p className="text-xs text-secondary mt-1">{t('sourceCurrent.scope')}</p>
      {query.isError ? <p role="alert" className="text-xs text-red-600 mt-2">{t('sourceCurrent.error')}</p> : query.isLoading ? <p className="text-xs text-secondary mt-2">{t('common:status.loading')}</p> : data && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
          {metrics.map(key => <div key={key} className="min-w-0 rounded border border-[var(--border-subtle)] p-3">
            <p className="text-xs text-secondary">{t(`sourceCurrent.${key}`)}</p>
            <p className="text-xl font-semibold tabular-nums mt-1" data-metric={key}>{data[key].toLocaleString(i18n.language)}</p>
            <p className="text-[11px] text-secondary mt-1">{t(`sourceCurrent.${key}Hint`)}</p>
          </div>)}
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">{['MARKETING','CS','OPERATING','CLASS'].map(category=><section key={category} className="border rounded p-3"><h3 className="font-semibold mb-2">{t(`category.${category}`)}</h3><dl>{data.metrics.filter(m=>m.category===category).sort((a,b)=>a.displayOrder-b.displayOrder).map(m=><div key={m.code} className="flex justify-between gap-2 py-1"><dt>{i18n.language.startsWith('ko')?m.labelKr:m.labelEn}</dt><dd>{['cs_scheduling','cs_scheduled','cs_new_class','ops_new_st','ops_returning_st','ops_referral_st'].includes(m.code)?<button className="underline" type="button" onClick={()=>setDetail(m.code)}><DualValue cell={data.values[m.code]}/></button>:<DualValue cell={data.values[m.code]}/>}</dd></div>)}</dl></section>)}</div>
        <p className="text-xs text-secondary">{t('life.todayScope',{date:data.today})}</p>
        <p className="text-xs text-secondary">{t('life.externalSync')}: {data.externalSyncedAt??'—'} · {data.externalDataDate??'—'}</p>
        {data.externalSources.map((source,i)=><p className="text-xs text-secondary" key={`${source.provider}:${i}`}>{source.provider} · {source.syncedAt??'—'} · {source.dataDate??'—'} · {source.status??'—'}</p>)}
        {detail&&<LifecycleDetails date={data.today} code={detail} close={()=>setDetail(null)}/>}
        <p className="text-[11px] text-secondary mt-2">{t('sourceCurrent.asOf', { date: new Date(data.asOf).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' }) })}</p>
        <details className="text-xs text-secondary mt-2">
          <summary className="cursor-pointer">{t('sourceCurrent.quality')}</summary>
          <p className="mt-1">{t('sourceCurrent.missing', { admission: data.missingAdmissionDates, withdrawal: data.missingWithdrawalDates, hire: data.missingHireDates })}</p>
          <p className="mt-1">{t('sourceCurrent.history')}</p>
        </details>
      </>}
    </section>
  );
}
