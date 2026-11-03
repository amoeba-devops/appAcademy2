import { useTranslation } from "react-i18next";
import type { TeacherClassInfo } from "../types";
import { ClassLinksEditor } from "@/components/common/class-links";
/**
 * REQ-261103B — 화면에 보이는 강사별 수업정보: 과목·교재·수업링크.
 * REQ-261103C — 수업링크는 여러 개(이름+주소), 주소 형식 검사 없음.
 * 추가교재·이동수단·GPA·SSAT/ISEE 는 숨김(저장된 값은 그대로 보존 — 보내지 않으면 서버가 유지).
 */
/** 학생 행에 남아 있는 예전 공통 값(강사 배정 전). 화면에는 과목·교재만. */
export const LEGACY_FIELDS = [
  "subject",
  "curriculum",
  "materials",
  "mobility",
  "gpa",
  "ssatIseeNote",
] as const;
export const LEGACY_VISIBLE = ["subject", "curriculum"] as const;
export const CLASS_LIMITS = {
  subject: 100,
  curriculum: 20000,
};
export function emptyClassInfo(tchId: string): TeacherClassInfo {
  return { tchId, subject: "", curriculum: "", links: [] };
}
export function TeacherClassFields({
  value,
  onChange,
}: {
  value: TeacherClassInfo;
  onChange: (value: TeacherClassInfo) => void;
}) {
  const { t } = useTranslation("std");
  const box =
    "w-full rounded border p-2 bg-surface text-base sm:text-sm text-primary placeholder:italic placeholder:text-secondary";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label>
        <span className="block text-xs text-secondary mb-1">
          {t("field.subject")}
        </span>
        <input
          maxLength={CLASS_LIMITS.subject}
          value={value.subject ?? ""}
          placeholder={t("detail.enterValue")}
          className={box}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
        />
      </label>
      <label>
        <span className="block text-xs text-secondary mb-1">
          {t("field.curriculum")}
        </span>
        <input
          maxLength={CLASS_LIMITS.curriculum}
          value={value.curriculum ?? ""}
          placeholder={t("detail.enterValue")}
          className={box}
          onChange={(e) => onChange({ ...value, curriculum: e.target.value })}
        />
      </label>
      <div className="sm:col-span-2">
        <span className="block text-xs text-secondary mb-1">
          {t("field.meetingUrl")}
        </span>
        <ClassLinksEditor
          value={value.links ?? []}
          onChange={(links) => onChange({ ...value, links })}
        />
      </div>
    </div>
  );
}
