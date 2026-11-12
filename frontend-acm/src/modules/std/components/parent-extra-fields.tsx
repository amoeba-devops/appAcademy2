import { useTranslation } from 'react-i18next';

/** REQ-261112 — 학부모 메신저 종류 (backend PARENT_MESSENGER_TYPES 와 동일). */
export const PARENT_MESSENGER_TYPES = [
  'KAKAOTALK',
  'LINE',
  'WECHAT',
  'WHATSAPP',
  'TELEGRAM',
  'ZALO',
] as const;

/** 자주 쓰는 전화 국가번호. 목록에 없는 기존 값도 그대로 보여 준다. */
export const COUNTRY_CODES: Array<{ code: string; iso: string }> = [
  { code: '+82', iso: 'KR' },
  { code: '+84', iso: 'VN' },
  { code: '+86', iso: 'CN' },
  { code: '+1', iso: 'US/CA' },
  { code: '+81', iso: 'JP' },
  { code: '+852', iso: 'HK' },
  { code: '+886', iso: 'TW' },
  { code: '+65', iso: 'SG' },
  { code: '+66', iso: 'TH' },
  { code: '+63', iso: 'PH' },
  { code: '+62', iso: 'ID' },
  { code: '+60', iso: 'MY' },
  { code: '+61', iso: 'AU' },
  { code: '+64', iso: 'NZ' },
  { code: '+44', iso: 'GB' },
  { code: '+49', iso: 'DE' },
  { code: '+33', iso: 'FR' },
  { code: '+7', iso: 'RU/KZ' },
  { code: '+91', iso: 'IN' },
  { code: '+971', iso: 'AE' },
];

export interface ParentExtraValues {
  parCountryCode: string;
  parMessengerType: string;
  parMessengerId: string;
  parMemo: string;
}

export const EMPTY_PARENT_EXTRA: ParentExtraValues = {
  parCountryCode: '',
  parMessengerType: '',
  parMessengerId: '',
  parMemo: '',
};

/** "+82 010-1234-5678" — 국가번호가 있으면 앞에 붙인다. */
export function formatParentPhone(countryCode?: string | null, phone?: string | null): string | null {
  if (!phone) return null;
  return countryCode ? `${countryCode} ${phone}` : phone;
}

/** 국가번호 select (전화번호 입력란 앞에 붙여 쓰는 용도). */
export function CountryCodeSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { t } = useTranslation('std');
  const known = COUNTRY_CODES.some((c) => c.code === value);
  return (
    <select
      aria-label={t('field.parentCountryCode', '국가번호')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">—</option>
      {!known && value && <option value={value}>{value}</option>}
      {COUNTRY_CODES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} {c.iso}
        </option>
      ))}
    </select>
  );
}

/** 메신저(종류+아이디) + 메모 입력란. 2열 grid 안에 넣어 쓴다. */
export function ParentMessengerMemoFields({
  value,
  onChange,
  inputClass,
  labelClass,
}: {
  value: ParentExtraValues;
  onChange: (patch: Partial<ParentExtraValues>) => void;
  inputClass: string;
  labelClass: string;
}) {
  const { t } = useTranslation('std');
  return (
    <>
      <div>
        <label className={labelClass}>{t('field.parentMessenger', '메신저')}</label>
        <select
          value={value.parMessengerType}
          onChange={(e) =>
            onChange({
              parMessengerType: e.target.value,
              ...(e.target.value ? {} : { parMessengerId: '' }),
            })
          }
          className={inputClass}
        >
          <option value="">—</option>
          {PARENT_MESSENGER_TYPES.map((m) => (
            <option key={m} value={m}>
              {t(`messenger.${m}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t('field.parentMessengerId', '메신저 아이디')}</label>
        <input
          value={value.parMessengerId}
          maxLength={100}
          disabled={!value.parMessengerType}
          onChange={(e) => onChange({ parMessengerId: e.target.value })}
          className={inputClass + ' disabled:opacity-50'}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>{t('field.parentMemo', '메모')}</label>
        <textarea
          value={value.parMemo}
          maxLength={2000}
          rows={3}
          onChange={(e) => onChange({ parMemo: e.target.value })}
          className={inputClass.replace('h-9', 'min-h-[72px]') + ' py-2'}
        />
      </div>
    </>
  );
}
