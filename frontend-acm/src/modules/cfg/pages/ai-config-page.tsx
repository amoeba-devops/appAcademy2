import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, KeyRound, Loader2, PlugZap, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { type AiConfigInput, type AiProvider, useAiConfig, useRemoveAiKey, useSaveAiConfig, useTestAiConfig } from '../hooks/use-ai-config';

const PROVIDERS: AiProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI', 'CUSTOM_OPENAI_COMPATIBLE'];
const MODELS: Record<AiProvider, string[]> = {
  OPENAI: ['gpt-5.4', 'gpt-5-mini'], ANTHROPIC: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  GOOGLE_GEMINI: ['gemini-2.5-pro', 'gemini-2.5-flash'], CUSTOM_OPENAI_COMPATIBLE: [],
};

export function AiConfigPage() {
  const { t } = useTranslation('common'); const toast = useToast();
  const query = useAiConfig(); const save = useSaveAiConfig(); const test = useTestAiConfig(); const remove = useRemoveAiKey();
  const [provider, setProvider] = useState<AiProvider>('OPENAI'); const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState(''); const [baseUrl, setBaseUrl] = useState('');
  const [orgProjectId, setOrgProjectId] = useState(''); const [isActive, setIsActive] = useState(false);
  useEffect(() => { if (!query.data) return; setProvider(query.data.provider ?? 'OPENAI'); setModelId(query.data.modelId); setBaseUrl(query.data.baseUrl ?? ''); setOrgProjectId(query.data.orgProjectId ?? ''); setIsActive(query.data.isActive); setApiKey(''); }, [query.data]);
  const payload = (): AiConfigInput => ({ provider, modelId: modelId.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(provider === 'CUSTOM_OPENAI_COMPATIBLE' ? { baseUrl: baseUrl.trim() } : {}), ...(orgProjectId.trim() ? { orgProjectId: orgProjectId.trim() } : {}), isActive });
  const invalid = !modelId.trim() || (provider === 'CUSTOM_OPENAI_COMPATIBLE' && !baseUrl.trim());
  const error = () => toast.error(t('aiConfig.failed'));
  return <main className="w-full min-w-0 space-y-5">
    <Link to="/admin/config" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"><ArrowLeft size={16}/>{t('config.backToList')}</Link>
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><Bot className="mt-0.5 text-accent-700"/><div><h1 className="text-xl font-semibold text-primary">{t('aiConfig.title')}</h1><p className="text-sm text-secondary">{t('aiConfig.description')}</p></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)}/>{t('aiConfig.active')}</label></header>
    {query.isLoading ? <p>{t('config.loading')}</p> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-5 rounded-lg border bg-white p-6">
        <div className="space-y-1.5"><Label htmlFor="ai-provider">{t('aiConfig.provider')}</Label><select id="ai-provider" className="w-full rounded-md border p-2.5" value={provider} onChange={e=>{const p=e.target.value as AiProvider; setProvider(p); setModelId(MODELS[p][0] ?? '');}}>{PROVIDERS.map(p=><option key={p} value={p}>{t(`aiConfig.providers.${p}`)}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="ai-model">{t('aiConfig.model')}</Label><Input id="ai-model" list="ai-model-presets" value={modelId} onChange={e=>setModelId(e.target.value)} placeholder={t('aiConfig.modelPlaceholder')}/><datalist id="ai-model-presets">{MODELS[provider].map(m=><option key={m} value={m}/>)}</datalist><p className="text-xs text-secondary">{t('aiConfig.modelHint')}</p></div>
        {provider === 'CUSTOM_OPENAI_COMPATIBLE' && <div className="space-y-1.5"><Label htmlFor="ai-url">{t('aiConfig.baseUrl')}</Label><Input id="ai-url" type="url" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://ai.example.com/v1"/></div>}
        <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="ai-key">{t('aiConfig.apiKey')}</Label><span className="text-xs text-secondary">{query.data?.apiKeyIsSet ? t('aiConfig.keySet') : t('aiConfig.keyUnset')}</span></div><Input id="ai-key" type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={query.data?.apiKeyIsSet ? t('aiConfig.keepKey') : t('aiConfig.enterKey')}/></div>
        <div className="space-y-1.5"><Label htmlFor="ai-org">{t('aiConfig.orgProject')}</Label><Input id="ai-org" value={orgProjectId} onChange={e=>setOrgProjectId(e.target.value)}/></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={invalid || test.isPending} onClick={()=>test.mutate(payload(),{onSuccess:()=>toast.success(t('aiConfig.testOk')),onError:error})}>{test.isPending?<Loader2 className="mr-2 animate-spin" size={16}/>:<PlugZap className="mr-2" size={16}/>} {t('aiConfig.test')}</Button><Button disabled={invalid || save.isPending} onClick={()=>save.mutate(payload(),{onSuccess:()=>{setApiKey('');toast.success(t('config.saved'));},onError:error})}><Save className="mr-2" size={16}/>{t('aiConfig.save')}</Button>{query.data?.apiKeyIsSet&&<Button variant="outline" disabled={remove.isPending} onClick={()=>{if(window.confirm(t('aiConfig.removeConfirm')))remove.mutate(undefined,{onSuccess:()=>toast.success(t('aiConfig.removed')),onError:error});}}><Trash2 className="mr-2" size={16}/>{t('aiConfig.removeKey')}</Button>}</div>
      </section>
      <aside className="h-fit space-y-4 rounded-lg border bg-white p-5 text-sm text-secondary lg:sticky lg:top-4"><h2 className="flex items-center gap-2 font-semibold text-primary"><KeyRound size={17}/>{t('aiConfig.securityTitle')}</h2><ul className="list-disc space-y-2 pl-5"><li>{t('aiConfig.security1')}</li><li>{t('aiConfig.security2')}</li><li>{t('aiConfig.security3')}</li></ul><div className="border-t pt-4"><h3 className="font-semibold text-primary">{t('aiConfig.lastTest')}</h3><p className="mt-2">{query.data?.lastTestStatus ? `${query.data.lastTestStatus} · ${query.data.lastTestedAt ? new Date(query.data.lastTestedAt).toLocaleString() : ''}` : t('aiConfig.notTested')}</p></div></aside>
    </div>}
  </main>;
}
