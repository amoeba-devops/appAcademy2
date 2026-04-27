'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAmaClientSearch, type AmaClient } from '@/hooks/use-teachers';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle2, AlertCircle } from 'lucide-react';

interface AmaClientPickerProps {
  selected: AmaClient | null;
  onSelect: (client: AmaClient | null) => void;
}

/**
 * Debounced AMA Client search + selection. Used in Teacher creation form.
 * The picker is the only path to populate `amaClientId` — direct typing is not allowed.
 */
export function AmaClientPicker({ selected, onSelect }: AmaClientPickerProps) {
  const { t } = useTranslation('admin');
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { data: results = [], isFetching } = useAmaClientSearch(debounced);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('teachers.ama-picker.search-placeholder', '이름 또는 사번으로 검색...')}
          className="pl-9"
          aria-label={t('teachers.ama-picker.search-label', 'AMA Client 검색')}
        />
      </div>

      {/* Results list */}
      {debounced.length > 0 && (
        <div className="rounded-md border max-h-56 overflow-y-auto">
          {isFetching ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t('common.loading', { ns: 'common', defaultValue: '검색 중...' })}
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('teachers.ama-picker.no-results', '검색 결과가 없습니다.')}
            </div>
          ) : (
            <ul className="divide-y">
              {results.map((c) => {
                const isSelected = selected?.amaClientId === c.amaClientId;
                return (
                  <li key={c.amaClientId}>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className={`w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-muted/40' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {c.amaClientId} · {c.phone ?? '—'}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-[#C9A656] shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Selected card */}
      {selected && (
        <div className="rounded-md border-2 border-[#C9A656] bg-[#FAF7EE] p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="font-medium">{selected.name}</div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              {t('teachers.ama-picker.clear', '선택 해제')}
            </button>
          </div>
          <div className="text-sm text-muted-foreground font-mono">
            {selected.amaClientId} · {selected.phone ?? '—'} · {selected.email ?? '—'}
          </div>
          <div className="text-xs text-muted-foreground pt-1">
            ⓘ {t('teachers.ama-picker.notice', '이름·연락처는 AMA에서 관리됩니다 (TAC 수정 불가)')}
          </div>
        </div>
      )}
    </div>
  );
}
