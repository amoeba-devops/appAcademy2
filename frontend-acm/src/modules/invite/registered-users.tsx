import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { registeredUserApi, type RegisteredUser, type RegisteredUserType } from './invite-api';

const TYPES: RegisteredUserType[] = ['ALL', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT'];

/** 관리 화면 이동(관리자는 별도 화면 없음). */
const manageLink = (u: RegisteredUser) =>
  u.type === 'STUDENT' && u.ref_id
    ? `/admin/std/${u.ref_id}`
    : u.type === 'TEACHER'
      ? '/admin/tch'
      : u.type === 'STAFF'
        ? '/admin/stf'
        : null;

/** REQ-261018B — 등록 사용자 탭(콘솔 관리자·직원·강사 + 로그인 계정이 발급된 포털 학생·강사). */
export function RegisteredUsers() {
  const { t, i18n } = useTranslation('common');
  const [type, setType] = useState<RegisteredUserType>('ALL');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setQ(input), 300);
    return () => clearTimeout(h);
  }, [input]);
  const list = useQuery({
    queryKey: ['registered-users', type, q],
    queryFn: () => registeredUserApi.list(type, q),
    placeholderData: keepPreviousData,
  });
  const fmt = (v: string | null, time = true) =>
    v
      ? new Date(v).toLocaleString(i18n.language, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
        })
      : '—';
  const login = (u: RegisteredUser) =>
    t(`invite.users.login.${u.source === 'PORTAL' ? 'portal' : u.auth_source === 'ama' ? 'ama' : 'local'}`);
  const badges = (u: RegisteredUser) => (
    <>
      {u.permissions.map((p) => (
        <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
          {t(`invite.users.perm.${p}`, p)}
        </span>
      ))}
      {(u.locked || u.status !== 'ACTIVE') && (
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
          {u.locked ? t('invite.users.locked') : t('invite.users.inactive')}
        </span>
      )}
    </>
  );
  const nameCell = (u: RegisteredUser) => {
    const to = manageLink(u);
    return to ? (
      <Link to={to} className="inline-flex min-h-9 items-center font-medium text-accent-700 hover:underline sm:inline sm:min-h-0">
        {u.name}
      </Link>
    ) : (
      <span className="font-medium">{u.name}</span>
    );
  };
  const users = list.data?.users ?? [];
  return (
    <section className="grid min-w-0 gap-4" aria-label={t('invite.tabs.users')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {TYPES.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={type === k}
              onClick={() => setType(k)}
              className={`min-h-9 rounded-full border px-3 py-1 text-xs sm:min-h-0 ${
                type === k ? 'border-accent-700 bg-accent-700 text-white' : 'bg-surface text-secondary'
              }`}
            >
              {t(`invite.users.types.${k}`)} {list.data?.counts[k] ?? ''}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <Input
            className="pl-8"
            value={input}
            maxLength={100}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('invite.users.search')}
            aria-label={t('invite.users.search')}
          />
        </label>
      </div>
      {list.isLoading && <p role="status">{t('invite.loading')}</p>}
      {list.isError && <p role="alert">{t('invite.users.loadError')}</p>}
      {list.data && users.length === 0 && (
        <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('invite.users.empty')}</p>
      )}
      {users.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-canvas text-left text-xs text-secondary">
                <tr>
                  {(['name', 'loginId', 'type', 'login', 'flags', 'createdAt', 'lastLogin'] as const).map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                      {t(`invite.users.cols.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={`${u.source}:${u.id}`} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">{nameCell(u)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-secondary">{u.login_id}</td>
                    <td className="whitespace-nowrap px-3 py-2">{t(`invite.users.types.${u.type}`)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{login(u)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">{badges(u)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-secondary">{fmt(u.created_at, false)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-secondary">{fmt(u.last_login_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {users.map((u) => (
              <li key={`${u.source}:${u.id}`} className="grid gap-1 rounded-lg border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {nameCell(u)}
                  <span className="rounded bg-accent-50 px-1.5 py-0.5 text-xs text-accent-700">
                    {t(`invite.users.types.${u.type}`)}
                  </span>
                  <span className="text-xs text-secondary">{login(u)}</span>
                  {badges(u)}
                </div>
                <p className="truncate text-secondary">{u.login_id}</p>
                <p className="text-xs text-secondary">
                  {t('invite.users.cols.createdAt')} {fmt(u.created_at, false)} · {t('invite.users.cols.lastLogin')}{' '}
                  {fmt(u.last_login_at)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
