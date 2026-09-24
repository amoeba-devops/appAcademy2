import { useId, useState } from 'react';
import { ChevronDown, ExternalLink, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AD_PROVIDERS, type AdProvider } from '../types/ads';

const LINKS: Partial<Record<AdProvider, string>> = {
  GOOGLE: 'https://developers.google.com/google-ads/api/docs/oauth/overview',
  NAVER_SEARCH: 'https://naver.github.io/searchad-apidoc/',
  NAVER_GFA: 'https://gfa.naver.com/',
  META: 'https://developers.facebook.com/docs/marketing-apis/',
};

export function AdProviderGuidePanel({ selected, onSelect }: { selected: AdProvider; onSelect: (provider: AdProvider) => void }) {
  const { t } = useTranslation('common'); const [helpOpen, setHelpOpen] = useState(false); const helpId = useId();
  return <aside className="h-fit space-y-4 rounded-lg border bg-white p-4 text-sm text-gray-600 lg:sticky lg:top-4">
    <h2 className="font-bold text-gray-900">{t('adsGuide.title')}</h2>
    <nav aria-label={t('adsGuide.title')} className="grid grid-cols-2 gap-1">{AD_PROVIDERS.map(p=><button key={p} type="button" onClick={()=>onSelect(p)} className={`rounded border px-2 py-2 text-xs font-medium ${selected===p?'border-indigo-600 bg-indigo-50 text-indigo-800':'bg-white hover:bg-gray-50'}`}>{t(`ads.providers.${p}`)}</button>)}</nav>
    <section aria-live="polite" className="space-y-3"><div><h3 className="font-semibold text-gray-900">{t(`adsGuide.${selected}.title`)}</h3><p className={`mt-1 text-xs ${selected==='NAVER_GFA'?'text-amber-800':'text-emerald-700'}`}>{t(`adsGuide.${selected}.status`)}</p></div>
      {(['prepare','input','verify','trouble'] as const).map(k=><div key={k}><h4 className="font-medium text-gray-900">{t(`adsGuide.sections.${k}`)}</h4><p className="mt-1 whitespace-pre-line text-xs leading-5">{t(`adsGuide.${selected}.${k}`)}</p></div>)}
      <a href={LINKS[selected]} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-indigo-700">{t('adsGuide.official')}<ExternalLink size={13}/></a>
    </section>
    <section className="border-t pt-3"><button type="button" className="flex w-full items-center justify-between rounded px-1 py-2 text-left font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-expanded={helpOpen} aria-controls={helpId} onClick={()=>setHelpOpen(v=>!v)}><span className="flex items-center gap-2"><Info size={16}/>{t('ads.help')}</span><ChevronDown size={16} className={`transition-transform ${helpOpen?'rotate-180':''}`}/></button>{helpOpen&&<div id={helpId} className="space-y-2 px-1 pb-1 text-xs leading-5"><p>{t('ads.helpBody')}</p><p>{t('ads.mappingWarning')}</p><p>{t('ads.oauthHelp')}</p></div>}</section>
  </aside>;
}
