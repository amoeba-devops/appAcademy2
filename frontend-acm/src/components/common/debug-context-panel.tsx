import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Copy, Check, Bug } from 'lucide-react';

function decodeJwtPayload(token: string): string {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return '(invalid token)';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.stringify(JSON.parse(atob(base64)), null, 2);
  } catch {
    return '(decode error)';
  }
}

interface DebugContextPanelProps {
  initialReferrer: string;
  initialQueryParams: string;
}

export function DebugContextPanel({
  initialReferrer,
  initialQueryParams,
}: DebugContextPanelProps) {
  const { t } = useTranslation('auth');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const initialAmaToken =
    new URLSearchParams(initialQueryParams).get('ama_token') ?? '';
  const currentParams = window.location.search;

  const content = [
    `─── ${t('debug.referer')} ───`,
    initialReferrer || '(empty)',
    '',
    `─── ${t('debug.initialParams')} ───`,
    initialQueryParams || '(empty)',
    '',
    `─── ${t('debug.currentParams')} ───`,
    currentParams || '(empty)',
    '',
    `─── ${t('debug.jwtToken')} ───`,
    initialAmaToken || '(no token)',
    '',
    `─── ${t('debug.jwtPayload')} ───`,
    initialAmaToken ? decodeJwtPayload(initialAmaToken) : '(no token)',
  ].join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-0 right-4 z-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-1 flex items-center gap-1.5 rounded-t-lg bg-yellow-400 px-3 py-1.5 text-xs font-medium text-yellow-900 shadow-md hover:bg-yellow-500"
      >
        <Bug className="h-3.5 w-3.5" />
        {t('debug.title')}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>
      {expanded && (
        <div className="w-[480px] rounded-tl-lg border-2 border-dashed border-yellow-400 bg-yellow-50 shadow-lg">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-yellow-800">
              {t('debug.title')}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-yellow-700 transition-colors hover:bg-yellow-200"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? t('debug.copied') : t('debug.copy')}
            </button>
          </div>
          <textarea
            readOnly
            value={content}
            rows={16}
            className="w-full resize-y border-t border-yellow-300 bg-white p-3 font-mono text-xs text-gray-800 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
