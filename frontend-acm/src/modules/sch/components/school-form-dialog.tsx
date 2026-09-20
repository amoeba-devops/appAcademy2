import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AdmissionInfo, School } from "../types/school";

export type SchoolFormValue = Partial<School>;
interface Props {
  open: boolean;
  initial?: SchoolFormValue | null;
  onClose: () => void;
  onSaved: () => void;
}
const emptySchool = (): SchoolFormValue => ({
  name: "",
  level: "FOREIGN",
  isForeign: true,
  isAuthorized: null,
  admissions: [],
});
export function SchoolFormDialog({ open, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation("sch");
  const toast = useToast();
  const [value, setValue] = useState<SchoolFormValue>(emptySchool);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setValue(
        initial
          ? {
              ...initial,
              admissions: initial.admissions?.map((a) => ({ ...a })) ?? [],
            }
          : emptySchool(),
      );
      setError("");
    }
  }, [open, initial]);
  const input =
    "w-full rounded border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm placeholder:italic placeholder:text-secondary";
  const field = (
    key:
      | "name"
      | "region"
      | "district"
      | "curriculumDescription"
      | "eligibility"
      | "notes",
    multiline = false,
  ) => (
    <label className="block space-y-1" key={key}>
      <span className="text-xs text-secondary">
        {t(`columns.${key}`)}
        {key === "name" ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          className={input}
          rows={3}
          maxLength={key === "curriculumDescription" ? 2000 : 10000}
          placeholder={t("catalog.placeholder")}
          value={value[key] ?? ""}
          onChange={(e) => setValue((v) => ({ ...v, [key]: e.target.value }))}
        />
      ) : (
        <input
          className={input}
          required={key === "name"}
          minLength={key === "name" ? 2 : undefined}
          maxLength={key === "name" ? 100 : 50}
          placeholder={t("catalog.placeholder")}
          value={value[key] ?? ""}
          onChange={(e) => setValue((v) => ({ ...v, [key]: e.target.value }))}
        />
      )}
    </label>
  );
  const updateAdmission = (i: number, key: keyof AdmissionInfo, text: string) =>
    setValue((v) => ({
      ...v,
      admissions: v.admissions?.map((a, j) =>
        j === i ? { ...a, [key]: text } : a,
      ),
    }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: value.name?.trim(),
      level: value.level,
      region: value.region ?? "",
      district: value.district ?? "",
      isForeign: value.isForeign ?? false,
      isAuthorized: value.isAuthorized ?? null,
      curriculumDescription: value.curriculumDescription ?? "",
      eligibility: value.eligibility ?? "",
      notes: value.notes ?? "",
      admissions: (value.admissions ?? []).filter(
        (a) =>
          a.id ||
          [a.targetLabel, a.examContent, a.scheduleText].some((v) => v?.trim()),
      ),
      ...(value.id && value.updatedAt
        ? { expectedUpdatedAt: value.updatedAt }
        : {}),
    };
    try {
      if (value.id)
        await apiClient.patch(`/acm/sch/schools/${value.id}`, payload);
      else await apiClient.post("/acm/sch/schools", payload);
      toast.success(t("catalog.saved"));
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("catalog.saveError"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-surface">
        <DialogTitle>{t(value.id ? "editSchool" : "newSchool")}</DialogTitle>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("name")}
              {field("region")}
            </div>
            {field("curriculumDescription", true)}
            <label className="block text-xs text-secondary">
              {t("columns.authorized")}
              <select
                className={input}
                value={
                  value.isAuthorized === null ||
                  value.isAuthorized === undefined
                    ? "unknown"
                    : value.isAuthorized
                      ? "yes"
                      : "no"
                }
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    isAuthorized:
                      e.target.value === "unknown"
                        ? null
                        : e.target.value === "yes",
                  }))
                }
              >
                <option value="unknown">{t("authorized.unknown")}</option>
                <option value="yes">{t("authorized.yes")}</option>
                <option value="no">{t("authorized.no")}</option>
              </select>
            </label>
            {field("eligibility", true)}
            {field("notes", true)}
            <details>
              <summary className="cursor-pointer text-sm">
                {t("catalog.legacy")}
              </summary>
              <div className="grid gap-3 mt-3 sm:grid-cols-2">
                {field("district")}
                <label className="block text-xs">
                  {t("columns.level")}
                  <select
                    className={input}
                    value={value.level}
                    onChange={(e) =>
                      setValue((v) => ({
                        ...v,
                        level: e.target.value as School["level"],
                      }))
                    }
                  >
                    {["ELEMENTARY", "MIDDLE", "HIGH", "FOREIGN"].map((l) => (
                      <option key={l} value={l}>
                        {t(`levels.${l}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <input
                    type="checkbox"
                    checked={value.isForeign ?? false}
                    onChange={(e) =>
                      setValue((v) => ({ ...v, isForeign: e.target.checked }))
                    }
                  />{" "}
                  {t("form.isForeign")}
                </label>
              </div>
            </details>
            <h3 className="font-bold text-sm">{t("catalog.admissions")}</h3>
            {(value.admissions ?? []).map((a, i) => (
              <section
                key={a.id ?? i}
                className="rounded-lg border border-[var(--border-subtle)] p-3 space-y-3"
              >
                <div className="flex justify-between gap-2">
                  <h4 className="font-bold text-[13px]">
                    {t("catalog.admissionNumber", { number: i + 1 })}
                  </h4>
                  <button
                    type="button"
                    className="text-sm text-red-600"
                    onClick={() =>
                      setValue((v) => ({
                        ...v,
                        admissions: v.admissions?.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    {t("actions.delete")}
                  </button>
                </div>
                {(["targetLabel", "examContent", "scheduleText"] as const).map(
                  (key) => (
                    <label key={key} className="block space-y-1">
                      <span className="text-xs text-secondary">
                        {t(`catalog.${key}`)}
                      </span>
                      <textarea
                        rows={key === "targetLabel" ? 1 : 4}
                        className={input}
                        placeholder={t("catalog.placeholder")}
                        maxLength={key === "targetLabel" ? 200 : 10000}
                        value={a[key] ?? ""}
                        onChange={(e) =>
                          updateAdmission(i, key, e.target.value)
                        }
                      />
                    </label>
                  ),
                )}
              </section>
            ))}
            <button
              type="button"
              className="text-accent-700 text-sm"
              onClick={() =>
                setValue((v) => ({
                  ...v,
                  admissions: [...(v.admissions ?? []), {}],
                }))
              }
            >
              + {t("catalog.addAdmission")}
            </button>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={busy} onClick={onClose}>
              {t("catalog.cancel")}
            </button>
            <button
              disabled={busy}
              className="rounded bg-accent-600 text-white px-4 py-2"
              type="submit"
            >
              {t(busy ? "catalog.saving" : "catalog.save")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
