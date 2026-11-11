import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * REQ-261112C — 데이터 품질 배너: 한 줄 요약 + 펼침 상세 + 확인 링크.
 * 수납 대시보드에서 처음 쓰고, 원생현황·수업통계 등 다른 화면에서도 재사용한다.
 */
export function DataQualityBanner({
  summary,
  details,
  action,
}: {
  summary: ReactNode;
  details?: ReactNode;
  action?: ReactNode;
}) {
  const { t } = useTranslation("common");
  const head = (
    <>
      <span aria-hidden="true">⚠</span>
      <span className="min-w-[14rem] flex-1">{summary}</span>
      {action}
    </>
  );
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800" role="status">
      {details ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
            {head}
            <span className="text-xs">
              {t("dataQuality.details")} <span className="inline-block group-open:rotate-180">▾</span>
            </span>
          </summary>
          <div className="mt-2 pl-6 text-xs tabular-nums">{details}</div>
        </details>
      ) : (
        <div className="flex flex-wrap items-center gap-2">{head}</div>
      )}
    </div>
  );
}
