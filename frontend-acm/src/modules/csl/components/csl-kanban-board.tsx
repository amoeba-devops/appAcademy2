import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * REQ-260701 — CSL 신규상담 칸반보드 뷰.
 *
 * 6개 stage column (INTAKE → CLASS_STARTED) + DROPPED collapsed footer.
 * 카드는 클릭 시 상세로 이동 — 드래그-드롭 stage 전환은 out of scope
 * (workflow guard 재검토 필요).
 */

type Stage =
  | 'INTAKE'
  | 'MAP_TEST'
  | 'TRIAL_CLASS'
  | 'ENROLLMENT_COUNSELING'
  | 'PAYMENT'
  | 'CLASS_STARTED'
  | 'DROPPED';

export interface KanbanInquiry {
  id: string;
  seqNo: number;
  studentName: string;
  isAnonymous: boolean;
  schoolFreetext?: string | null;
  grade?: string | null;
  inflowType: 'HOMEPAGE' | 'KAKAO_CHANNEL' | 'PHONE';
  applyType: 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
  currentStage: Stage;
  registeredAt: string;
  followupAt?: string | null;
}

const ACTIVE_STAGES: Stage[] = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
];

// Column accent — mirrors the list-view stageBadgeClass.
const COLUMN_ACCENT: Record<Stage, string> = {
  INTAKE: 'border-accent-200 bg-accent-50/40',
  MAP_TEST: 'border-accent-200 bg-accent-50/40',
  TRIAL_CLASS: 'border-accent-200 bg-accent-50/40',
  ENROLLMENT_COUNSELING: 'border-accent-200 bg-accent-50/40',
  PAYMENT: 'border-amber-200 bg-amber-50/40',
  CLASS_STARTED: 'border-emerald-200 bg-emerald-50/40',
  DROPPED: 'border-[var(--border-subtle)] bg-[var(--gray-100)]',
};

export function CslKanbanBoard({
  inquiries,
  dateLocale,
}: {
  inquiries: KanbanInquiry[];
  dateLocale: string;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const [droppedOpen, setDroppedOpen] = useState(false);

  const byStage = useMemo(() => {
    const map = new Map<Stage, KanbanInquiry[]>();
    for (const s of [...ACTIVE_STAGES, 'DROPPED' as Stage]) map.set(s, []);
    for (const inq of inquiries) {
      const bucket = map.get(inq.currentStage);
      if (bucket) bucket.push(inq);
    }
    return map;
  }, [inquiries]);

  const droppedCount = byStage.get('DROPPED')?.length ?? 0;

  return (
    <div className="grid gap-4">
      {/* 6 active columns */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {ACTIVE_STAGES.map((stage) => {
          const cards = byStage.get(stage) ?? [];
          return (
            <section
              key={stage}
              className={`rounded-lg border ${COLUMN_ACCENT[stage]} p-2 flex flex-col min-h-[200px]`}
            >
              <header className="flex items-baseline justify-between px-1 py-2 mb-2 border-b border-[var(--border-subtle)]">
                <span className="text-sm font-semibold text-primary">
                  {t(`stage.${stage}`)}
                </span>
                <span className="text-[11px] text-secondary tabular-nums">
                  {cards.length}
                </span>
              </header>
              <div className="grid gap-2">
                {cards.length === 0 && (
                  <p className="text-[11px] text-secondary text-center py-4">
                    {t('kanban.emptyColumn')}
                  </p>
                )}
                {cards.map((c) => (
                  <KanbanCard key={c.id} inq={c} dateLocale={dateLocale} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* DROPPED — collapsed footer */}
      <section
        className={`rounded-lg border ${COLUMN_ACCENT.DROPPED} px-3 py-2`}
      >
        <button
          type="button"
          onClick={() => setDroppedOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          {droppedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="text-sm font-semibold">
            {t('stage.DROPPED')}
          </span>
          <span className="text-[11px] text-secondary tabular-nums">
            ({droppedCount})
          </span>
        </button>
        {droppedOpen && droppedCount > 0 && (
          <div className="grid gap-2 mt-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(byStage.get('DROPPED') ?? []).map((c) => (
              <KanbanCard key={c.id} inq={c} dateLocale={dateLocale} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  inq,
  dateLocale,
}: {
  inq: KanbanInquiry;
  dateLocale: string;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const navigate = useNavigate();

  const displayName = inq.isAnonymous
    ? t('anonymousInquiry', { seqNo: inq.seqNo })
    : inq.studentName;

  const registered = inq.registeredAt
    ? new Date(inq.registeredAt).toLocaleDateString(dateLocale)
    : null;
  const followup = inq.followupAt
    ? new Date(inq.followupAt).toLocaleDateString(dateLocale)
    : null;

  return (
    <button
      type="button"
      onClick={() => navigate(`/admin/csl/${inq.id}`)}
      className="rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2.5 text-left hover:border-accent-300 hover:shadow-sm transition text-xs"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="font-medium text-primary truncate">{displayName}</span>
        <span className="text-[10px] text-secondary tabular-nums">
          #{inq.seqNo}
        </span>
      </div>
      {(inq.schoolFreetext || inq.grade) && (
        <p className="text-[11px] text-secondary truncate">
          {inq.schoolFreetext ?? '—'}
          {inq.grade && ` · ${t(`grade.${inq.grade}`, inq.grade)}`}
        </p>
      )}
      <div className="flex flex-wrap gap-1 mt-1.5">
        <span className="rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-[9px] text-secondary">
          {t(`inflow.${inq.inflowType}`)}
        </span>
        <span className="rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-[9px] text-secondary">
          {t(`applyType.${inq.applyType}`)}
        </span>
      </div>
      {(registered || followup) && (
        <p className="text-[10px] text-secondary mt-1.5">
          {registered && (
            <>
              📥 {registered}
              {followup && ' · '}
            </>
          )}
          {followup && <>📞 {followup}</>}
        </p>
      )}
    </button>
  );
}
