import { useTranslation } from "react-i18next";
import type { TeacherClassInfo } from "../types";
export const CLASS_FIELDS = [
  "subject",
  "curriculum",
  "materials",
  "mobility",
  "gpa",
  "ssatIseeNote",
] as const;
export const CLASS_LIMITS = {
  subject: 100,
  curriculum: 20000,
  materials: 20000,
  mobility: 50,
  gpa: 20,
  ssatIseeNote: 20000,
};
export function emptyClassInfo(tchId: string): TeacherClassInfo {
  return {
    tchId,
    subject: "",
    curriculum: "",
    materials: "",
    mobility: "",
    gpa: "",
    ssatIseeNote: "",
  };
}
export function TeacherClassFields({
  value,
  onChange,
}: {
  value: TeacherClassInfo;
  onChange: (value: TeacherClassInfo) => void;
}) {
  const { t } = useTranslation("std");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CLASS_FIELDS.map((field) => (
        <label
          key={field}
          className={
            field === "curriculum" ||
            field === "materials" ||
            field === "ssatIseeNote"
              ? "sm:col-span-2"
              : ""
          }
        >
          <span className="block text-xs text-secondary mb-1">
            {t(`field.${field}`)}
          </span>
          <textarea
            rows={field === "materials" || field === "ssatIseeNote" ? 2 : 1}
            maxLength={CLASS_LIMITS[field]}
            value={value[field] ?? ""}
            placeholder={t("detail.enterValue")}
            className="w-full rounded border p-2 bg-surface text-sm text-primary placeholder:italic placeholder:text-secondary"
            onChange={(e) => onChange({ ...value, [field]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
