import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeacherMultiCombo } from "@/modules/cal/components/teacher-multi-combo";
import type { TeacherDetail } from "@/modules/tch/types";
interface Row {
  key: string;
  sheet: string;
  row: number;
  name: string;
  site: string;
  raw: Record<string, string>;
  values: Record<string, string>;
  warnings: string[];
  errors: string[];
  blocked: boolean;
  applied: boolean;
  teacherIds: string[];
  teacherNames: string[];
  teachers: Array<{ id: string; name: string }>;
  candidates: Array<{
    id: string;
    name: string;
    birthDate?: string;
    site?: string;
    values: Record<string, unknown>;
  }>;
}
interface Decision {
  key: string;
  action: "NEW" | "UPDATE";
  studentId?: string;
  reviewed: boolean;
  teacherIds: string[];
  email?: string;
  phone?: string;
}
export function StdImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("std");
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [teacherLabels, setTeacherLabels] = useState<
    Record<string, TeacherDetail[]>
  >({});
  const preview = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("file", file!);
      return (
        await apiClient.post<{ previewId: string; rows: Row[]; counts: Record<string, number> }>(
          "/acm/std/students/import/preview",
          form,
        )
      ).data;
    },
    onSuccess: () => {
      setDecisions({});
      setTeacherLabels({});
    },
  });
  const commit = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ applied: number }>(
          "/acm/std/students/import/commit",
          {
            previewId: preview.data!.previewId,
            decisions: Object.values(decisions).filter((d) => d.reviewed),
          },
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["std", "students"] }),
  });
  const change = (row: Row, patch: Partial<Decision>) =>
    setDecisions((all) => ({
      ...all,
      [row.key]: {
        ...(all[row.key] ?? {
          key: row.key,
          action: row.candidates.length ? "UPDATE" : "NEW",
          reviewed: false,
          teacherIds: row.teacherIds,
        }),
        ...patch,
      },
    }));
  const pending = preview.isPending || commit.isPending;
  const error = preview.error || commit.error;
  const errorMessage = (
    error as { response?: { data?: { error?: { message?: string } } } } | null
  )?.response?.data?.error?.message;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && !pending && onClose()}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("site.preview")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm">{t("site.expires")}</p>
        <input
          aria-label={t("actions.import")}
          type="file"
          accept=".xlsx"
          disabled={pending}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            preview.reset();
            commit.reset();
            setDecisions({});
          }}
        />
        <Button
          variant="outline"
          onClick={async () => {
            const response = await apiClient.get("/acm/std/students/template", {
              responseType: "blob",
            });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement("a");
            link.href = url;
            link.download = "students-by-site.xlsx";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          {t("import.downloadTemplate")}
        </Button>
        <Button disabled={!file || pending} onClick={() => preview.mutate()}>
          {t("site.preview")}
        </Button>
        {error && (
          <p role="alert" className="text-red-600">
            {t("site.saveError")}{" "}
            {errorMessage
              ? t(`siteIssues.${errorMessage}`, { defaultValue: "" })
              : ""}
          </p>
        )}
        {preview.data && !commit.data && (
          <>
            <p>
              {t("table.total", { count: preview.data.rows.length })} ·{" "}
              {t("site.contactHint")}
            </p>
            <div className="flex gap-3 text-sm">
              {["TPI", "TRINITY", "SANTACROCE"].map((site) => (
                <span key={site}>
                  {t(`site.${site}`)}:{" "}
                  {preview.data!.rows.filter((r) => r.site === site).length}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">{Object.entries(preview.data.counts ?? {}).map(([key, count]) => <span key={key}>{t(`importCounts.${key}`)}: {count}</span>)}</div>
            {preview.data.rows.map((row) => {
              const d = decisions[row.key];
              const blocked = row.blocked || row.applied;
              const candidate = row.candidates.find(
                (c) => c.id === d?.studentId,
              );
              const teacherValues =
                teacherLabels[row.key] ??
                row.teachers.map((teacher) => teacher as TeacherDetail);
              return (
                <details key={row.key} className="rounded border p-3">
                  <summary>
                    {row.sheet}:{row.row} · {row.name} ·{" "}
                    {blocked
                      ? t(row.applied ? "site.applied" : "site.blocked")
                      : d?.reviewed
                        ? t("site.apply")
                        : t("site.skip")}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-amber-700">
                      {[...row.errors, ...row.warnings]
                        .map((issue) => {
                          const [code, ...cells] = issue.split(":");
                          return (
                            t(`siteIssues.${code}`, {
                              defaultValue: t("site.review"),
                            }) +
                            (cells.length ? " (" + cells.join(":") + ")" : "")
                          );
                        })
                        .join(" · ")}
                    </p>
                    <dl className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(row.raw)
                        .filter(([, v]) => v)
                        .map(([col, value]) => (
                          <div key={col}>
                            <dt className="font-semibold">
                              {col}
                              {row.row}
                            </dt>
                            <dd className="whitespace-pre-wrap">{value}</dd>
                          </div>
                        ))}
                    </dl>
                    {!blocked && (
                      <>
                        <label>
                          {t("site.choose")}
                          <select
                            className="ml-2 border rounded p-2"
                            value={
                              d?.action === "NEW" ? "NEW" : (d?.studentId ?? "")
                            }
                            onChange={(e) =>
                              change(row, {
                                action:
                                  e.target.value === "NEW" ? "NEW" : "UPDATE",
                                studentId:
                                  e.target.value === "NEW"
                                    ? undefined
                                    : e.target.value,
                                reviewed: false,
                              })
                            }
                          >
                            <option value="">—</option>
                            {!row.candidates.length && (
                              <option value="NEW">{t("site.new")}</option>
                            )}
                            {row.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} / {c.birthDate ?? "—"} /{" "}
                                {t(`site.${c.site ?? "UNASSIGNED"}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <table className="w-full text-xs">
                          <tbody>
                            {Object.entries({
                              ...row.values,
                              site: row.site,
                            }).map(([field, value]) => (
                              <tr key={field}>
                                <th className="text-left">
                                  {field === "site"
                                    ? t("site.label")
                                    : t(`field.${field}`, field)}
                                </th>
                                <td className="whitespace-pre-wrap">
                                  {String(candidate?.values[field] ?? "—")}
                                </td>
                                <td>→</td>
                                <td className="whitespace-pre-wrap">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p>{t("site.teachers")}</p>
                        <TeacherMultiCombo
                          max={5}
                          value={teacherValues}
                          onChange={(next) => {
                            setTeacherLabels((v) => ({
                              ...v,
                              [row.key]: next,
                            }));
                            change(row, {
                              teacherIds: next.map((t) => t.id),
                              reviewed: false,
                            });
                          }}
                        />
                        <label>
                          {t("field.phone")}
                          <input
                            className="ml-2 border p-1"
                            maxLength={30}
                            value={d?.phone ?? ""}
                            onChange={(e) =>
                              change(row, {
                                phone: e.target.value || undefined,
                                reviewed: false,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("field.email")}
                          <input
                            type="email"
                            className="ml-2 border p-1"
                            maxLength={200}
                            value={d?.email ?? ""}
                            onChange={(e) =>
                              change(row, {
                                email: e.target.value || undefined,
                                reviewed: false,
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <input
                            type="checkbox"
                            checked={d?.reviewed ?? false}
                            disabled={
                              !d ||
                              (d.action === "UPDATE" && !d.studentId) ||
                              (row.teacherNames.length > 0 &&
                                !d.teacherIds.length)
                            }
                            onChange={(e) =>
                              change(row, { reviewed: e.target.checked })
                            }
                          />{" "}
                          {t("site.reviewed")}
                        </label>
                      </>
                    )}
                  </div>
                </details>
              );
            })}
            <Button
              disabled={
                pending || !Object.values(decisions).some((d) => d.reviewed)
              }
              onClick={() => commit.mutate()}
            >
              {t("site.apply")} (
              {Object.values(decisions).filter((d) => d.reviewed).length})
            </Button>
          </>
        )}
        {commit.data && (
          <p role="status">
            {t("site.result", { count: commit.data.applied })}
          </p>
        )}
        <Button variant="outline" disabled={pending} onClick={onClose}>
          {t("common:actions.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
