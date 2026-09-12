import { useTranslation } from 'react-i18next';
import { formatRegisteredAt } from '@/modules/csl/lib/registered-at';

/**
 * 요구 260912C — 신규상담 등록일 표시 (목록·칸반 공용).
 * 등록일(날짜) 뒤에 접수 시:분을 붙인다. 등록일을 소급 입력해 접수일과
 * 어긋나면 시:분 대신 접수 일시를 따로 표기한다 — 없는 시각을 지어내지 않는다.
 */
export function RegisteredAtCell({
  registeredAt,
  createdAt,
  locale,
  tz,
  dash = '—',
}: {
  registeredAt: string | null | undefined;
  createdAt: string | null | undefined;
  locale: string;
  tz?: string;
  dash?: string;
}) {
  const { t } = useTranslation('csl');
  const reg = formatRegisteredAt(registeredAt, createdAt, locale, tz);
  if (!reg) return <>{dash}</>;

  return (
    <span title={reg.title ?? undefined}>
      {reg.date}
      {reg.time && <span className="ml-1 tabular-nums">{reg.time}</span>}
      {reg.receivedAt && (
        <span className="ml-1 text-secondary">
          ({t('table.receivedAt', '접수')} {reg.receivedAt})
        </span>
      )}
    </span>
  );
}
