import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';

interface School {
  id: string;
  name: string;
  level: string;
  region?: string;
  isAuthorized: boolean;
}

interface CountMap {
  bands: Record<string, number>;
  schedules: Record<string, number>;
}

export function SchoolListPage() {
  const { t } = useTranslation('sch');
  const [schools, setSchools] = useState<School[] | null>(null);
  const [counts, setCounts] = useState<CountMap>({ bands: {}, schedules: {} });
  const [error, setError] = useState<string | null>(null);
  const [openSchool, setOpenSchool] = useState<{ school: School; tab: 'bands' | 'schedules' } | null>(null);

  useEffect(() => {
    apiClient.get('/acm/sch/schools')
      .then(async (res) => {
        const items: School[] = res.data.items ?? res.data ?? [];
        setSchools(items);
        const bands: Record<string, number> = {};
        const schedules: Record<string, number> = {};
        await Promise.all(items.map(async (s) => {
          const [b, sc] = await Promise.all([
            apiClient.get(`/acm/sch/schools/${s.id}/grade-bands`).catch(() => ({ data: [] })),
            apiClient.get(`/acm/sch/schools/${s.id}/schedules`).catch(() => ({ data: [] })),
          ]);
          bands[s.id] = Array.isArray(b.data) ? b.data.length : 0;
          schedules[s.id] = Array.isArray(sc.data) ? sc.data.length : 0;
        }));
        setCounts({ bands, schedules });
      })
      .catch((e) => setError(e.message ?? 'Failed to load'));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <button className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-surface hover:bg-[var(--bg-hover)]">
          + {t('newSchool')}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 mb-4 text-sm">{error}</div>}
      {!schools && !error && <div className="text-secondary">{t('loading')}</div>}
      {schools && schools.length === 0 && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-secondary">{t('empty')}</div>
      )}

      {schools && schools.length > 0 && (
        <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-left">
              <tr>
                <th className="px-3 py-2">{t('columns.name')}</th>
                <th className="px-3 py-2">{t('columns.level')}</th>
                <th className="px-3 py-2">{t('columns.region')}</th>
                <th className="px-3 py-2">{t('columns.authorized')}</th>
                <th className="px-3 py-2">{t('columns.bands')}</th>
                <th className="px-3 py-2">{t('columns.schedules')}</th>
                <th className="px-3 py-2">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{s.level}</td>
                  <td className="px-3 py-2">{s.region ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.isAuthorized ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {s.isAuthorized ? t('authorized.yes') : t('authorized.no')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setOpenSchool({ school: s, tab: 'bands' })}
                      className="underline text-blue-600"
                    >
                      {counts.bands[s.id] ?? 0} ▸
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setOpenSchool({ school: s, tab: 'schedules' })}
                      className="underline text-blue-600"
                    >
                      {counts.schedules[s.id] ?? 0} ▸
                    </button>
                  </td>
                  <td className="px-3 py-2 text-secondary">⋯</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openSchool && (
        <SchoolChildModal
          school={openSchool.school}
          tab={openSchool.tab}
          onClose={() => setOpenSchool(null)}
        />
      )}
    </div>
  );
}

interface ChildModalProps {
  school: School;
  tab: 'bands' | 'schedules';
  onClose: () => void;
}

interface GradeBand {
  id: string; label: string; gradeMin: number; gradeMax: number; note?: string | null;
}
interface Schedule {
  id: string; year: number; type: string;
  openDate?: string | null; closeDate?: string | null;
  testDate?: string | null; resultDate?: string | null;
}

function SchoolChildModal({ school, tab, onClose }: ChildModalProps) {
  const { t } = useTranslation('sch');
  const [items, setItems] = useState<(GradeBand | Schedule)[] | null>(null);

  useEffect(() => {
    const url = tab === 'bands'
      ? `/acm/sch/schools/${school.id}/grade-bands`
      : `/acm/sch/schools/${school.id}/schedules`;
    apiClient.get(url).then((r) => setItems(r.data ?? []));
  }, [school.id, tab]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-lg max-w-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {tab === 'bands'
              ? t('gradeBands.title', { school: school.name })
              : t('schedules.title', { school: school.name })}
          </h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>
        {!items && <div className="text-secondary">{t('loading')}</div>}
        {items && items.length === 0 && <div className="text-secondary">—</div>}
        {items && items.length > 0 && tab === 'bands' && (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-left">
              <tr>
                <th className="px-3 py-2">{t('gradeBands.label')}</th>
                <th className="px-3 py-2">{t('gradeBands.min')}</th>
                <th className="px-3 py-2">{t('gradeBands.max')}</th>
                <th className="px-3 py-2">{t('gradeBands.note')}</th>
              </tr>
            </thead>
            <tbody>
              {(items as GradeBand[]).map((b) => (
                <tr key={b.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">{b.label}</td>
                  <td className="px-3 py-2">{b.gradeMin}</td>
                  <td className="px-3 py-2">{b.gradeMax}</td>
                  <td className="px-3 py-2 text-secondary">{b.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items && items.length > 0 && tab === 'schedules' && (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-left">
              <tr>
                <th className="px-3 py-2">{t('schedules.year')}</th>
                <th className="px-3 py-2">{t('schedules.type')}</th>
                <th className="px-3 py-2">{t('schedules.open')}</th>
                <th className="px-3 py-2">{t('schedules.close')}</th>
                <th className="px-3 py-2">{t('schedules.test')}</th>
                <th className="px-3 py-2">{t('schedules.result')}</th>
              </tr>
            </thead>
            <tbody>
              {(items as Schedule[]).map((sc) => (
                <tr key={sc.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3 py-2">{sc.year}</td>
                  <td className="px-3 py-2">{sc.type}</td>
                  <td className="px-3 py-2">{sc.openDate ?? '—'}</td>
                  <td className="px-3 py-2">{sc.closeDate ?? '—'}</td>
                  <td className="px-3 py-2">{sc.testDate ?? '—'}</td>
                  <td className="px-3 py-2">{sc.resultDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
