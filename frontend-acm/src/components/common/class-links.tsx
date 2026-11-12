import { useTranslation } from "react-i18next";
import { Plus, Video, X } from "lucide-react";
import { meetingHref } from "@/modules/cfg/hooks/use-video-config";

/**
 * REQ-261103C — 강사별 수업링크 여러 개(이름 + 주소). 주소 형식 검사는 하지 않는다 —
 * 서버가 `https://` 를 보정하고 javascript: 같은 위험한 주소만 거부.
 * 관리자 학생 수정·강사 포털 수강생 상세가 같은 입력칸을 쓴다.
 */
export interface ClassLink {
  label?: string | null;
  url: string;
  /** REQ-261112D — 수업일정에 등록된 화상 링크(포털 표시 전용). */
  source?: "CAL";
}
export const MAX_CLASS_LINKS = 10;

export function ClassLinksEditor({
  value,
  onChange,
}: {
  value: ClassLink[];
  onChange: (value: ClassLink[]) => void;
}) {
  const { t } = useTranslation("common");
  const rows = value.length ? value : [{ label: "", url: "" }];
  const set = (i: number, patch: Partial<ClassLink>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const box =
    "min-w-0 rounded border p-2 bg-surface text-base sm:text-sm text-primary placeholder:italic placeholder:text-secondary";
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <input
            maxLength={50}
            value={r.label ?? ""}
            placeholder={t("classLinks.labelPlaceholder")}
            aria-label={t("classLinks.label")}
            className={`${box} w-full sm:w-36`}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            inputMode="url"
            maxLength={500}
            value={r.url}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            aria-label={t("classLinks.url")}
            className={`${box} flex-1`}
            onChange={(e) => set(i, { url: e.target.value })}
          />
          <button
            type="button"
            aria-label={t("classLinks.remove")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border text-secondary hover:text-red-600"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {rows.length < MAX_CLASS_LINKS && (
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 text-sm text-accent-700 hover:underline"
          onClick={() => onChange([...rows, { label: "", url: "" }])}
        >
          <Plus size={14} /> {t("classLinks.add")}
        </button>
      )}
    </div>
  );
}

/** 링크 목록 — 이름(없으면 "수업링크 n") · 주소 · [입장]. */
export function ClassLinkList({ links }: { links: ClassLink[] }) {
  const { t } = useTranslation("common");
  if (!links.length)
    return <p className="text-sm text-secondary">{t("classLinks.none")}</p>;
  return (
    <ul className="space-y-2">
      {links.map((l, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-primary">
              {l.label ||
                (l.source === "CAL"
                  ? t("classLinks.fromCalendar")
                  : t("classLinks.numbered", { n: i + 1 }))}
            </div>
            <div className="break-all text-xs text-secondary">{l.url}</div>
          </div>
          <a
            href={meetingHref(l.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md bg-accent-600 px-3 text-sm font-medium text-white hover:bg-accent-700"
          >
            <Video size={16} />
            {t("classLinks.join")}
          </a>
        </li>
      ))}
    </ul>
  );
}
