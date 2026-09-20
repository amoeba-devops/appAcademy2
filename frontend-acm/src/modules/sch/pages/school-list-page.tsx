import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SchoolFormDialog } from "@/modules/sch/components/school-form-dialog";
import {
  GradeBandFormDialog,
  type GradeBandFormValue,
} from "@/modules/sch/components/grade-band-form-dialog";
import {
  ScheduleFormDialog,
  type ScheduleFormValue,
} from "@/modules/sch/components/schedule-form-dialog";
import type { School } from "../types/school";

export function SchoolListPage() {
  const { t } = useTranslation("sch");
  const [q, setQ] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [region, setRegion] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["school-catalog", q, curriculum, region, authorization, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        q,
        curriculum,
        region,
        limit: "25",
        offset: String(page * 25),
      });
      if (authorization) params.set("authorization", authorization);
      return (
        await apiClient.get<{ items: School[]; total: number }>(
          `/acm/sch/schools?${params}`,
        )
      ).data;
    },
  });
  const input =
    "rounded border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm min-w-0 placeholder:italic placeholder:text-secondary";
  const filters = [
    { value: q, set: setQ, label: t("catalog.searchName") },
    {
      value: curriculum,
      set: setCurriculum,
      label: t("catalog.searchCurriculum"),
    },
    { value: region, set: setRegion, label: t("columns.region") },
  ];
  const authLabel = (s: School) =>
    t(
      s.isAuthorized === null
        ? "authorized.unknown"
        : s.isAuthorized
          ? "authorized.yes"
          : "authorized.no",
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <button className={input} onClick={() => setOpen(true)}>
          + {t("newSchool")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <input
            key={f.label}
            aria-label={f.label}
            placeholder={f.label}
            className={input + " w-44"}
            value={f.value}
            onChange={(e) => {
              f.set(e.target.value);
              setPage(0);
            }}
          />
        ))}
        <select
          aria-label={t("columns.authorized")}
          className={input}
          value={authorization}
          onChange={(e) => {
            setAuthorization(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{t("catalog.allAuthorization")}</option>
          <option value="yes">{t("authorized.yes")}</option>
          <option value="no">{t("authorized.no")}</option>
          <option value="unknown">{t("authorized.unknown")}</option>
        </select>
        <button
          className={input}
          onClick={() => {
            setQ("");
            setCurriculum("");
            setRegion("");
            setAuthorization("");
            setPage(0);
          }}
        >
          {t("catalog.reset")}
        </button>
      </div>
      <p className="text-sm text-secondary">
        {t("catalog.count", { count: data?.total ?? 0 })} ·{" "}
        {t("catalog.pageAdmissions", {
          count:
            data?.items.reduce((n, s) => n + (s.admissions?.length ?? 0), 0) ??
            0,
        })}
      </p>
      {isLoading ? (
        <div className="admin-list-surface p-6">{t("loading")}</div>
      ) : error ? (
        <div role="alert" className="admin-list-surface p-6">
          {t("catalog.loadError")}{" "}
          <button className="underline" onClick={() => void refetch()}>
            {t("catalog.retry")}
          </button>
        </div>
      ) : !data?.items.length ? (
        <div className="admin-list-surface p-6">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-surface">
          <table className="w-full min-w-[1740px] text-sm text-left">
            <thead className="bg-[var(--gray-50)]">
              <tr>
                {[
                  "name",
                  "curriculum",
                  "region",
                  "authorized",
                  "target",
                  "exam",
                  "eligibility",
                  "notes",
                  "schedule",
                  "actions",
                ].map((key, i) => (
                  <th
                    key={key}
                    className={
                      "p-3 " +
                      (i === 0
                        ? "sticky left-0 z-10 bg-[var(--gray-50)] w-52"
                        : "")
                    }
                  >
                    {t(`columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.flatMap((s) =>
                (s.admissions?.length ? s.admissions : [{}]).map(
                  (a, i, all) => (
                    <tr
                      key={`${s.id}-${a.id ?? i}`}
                      className="border-t border-[var(--border-subtle)] align-top"
                    >
                      {i === 0 && (
                        <>
                          <td
                            rowSpan={all.length}
                            className="sticky left-0 z-10 bg-surface p-3 font-medium max-w-52 break-words"
                          >
                            <Link
                              className="text-accent-700 underline"
                              to={`/admin/sch/${s.id}`}
                            >
                              {s.name}
                            </Link>
                          </td>
                          <td
                            rowSpan={all.length}
                            className="p-3 max-w-48 whitespace-pre-wrap break-words"
                          >
                            {s.curriculumDescription}
                          </td>
                          <td
                            rowSpan={all.length}
                            className="p-3 whitespace-pre-wrap"
                          >
                            {s.region}
                          </td>
                          <td
                            rowSpan={all.length}
                            className="p-3 whitespace-nowrap"
                          >
                            {authLabel(s)}
                          </td>
                        </>
                      )}
                      <td className="p-3 whitespace-pre-wrap">
                        {a.targetLabel}
                      </td>
                      <td className="p-3 min-w-64 max-w-80">
                        <div className="line-clamp-3 whitespace-pre-wrap break-words">
                          {a.examContent}
                        </div>
                        {a.examContent && (
                          <Link
                            className="text-accent-700 underline text-xs"
                            to={`/admin/sch/${s.id}#admission-${a.id}`}
                          >
                            {t("catalog.details")}
                          </Link>
                        )}
                      </td>
                      {i === 0 && (
                        <>
                          <td
                            rowSpan={all.length}
                            className="p-3 max-w-52 whitespace-pre-wrap break-words"
                          >
                            {s.eligibility}
                          </td>
                          <td
                            rowSpan={all.length}
                            className="p-3 max-w-48 whitespace-pre-wrap break-words"
                          >
                            {s.notes}
                          </td>
                        </>
                      )}
                      <td className="p-3 min-w-60 max-w-72">
                        <div className="line-clamp-3 whitespace-pre-wrap break-words">
                          {a.scheduleText}
                        </div>
                        {a.scheduleText && (
                          <Link
                            className="text-accent-700 underline text-xs"
                            to={`/admin/sch/${s.id}#admission-${a.id}`}
                          >
                            {t("catalog.details")}
                          </Link>
                        )}
                      </td>
                      {i === 0 && (
                        <td rowSpan={all.length} className="p-3">
                          <Link
                            className="underline text-accent-700"
                            to={`/admin/sch/${s.id}`}
                          >
                            {t("catalog.details")}
                          </Link>
                        </td>
                      )}
                    </tr>
                  ),
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end items-center gap-3 text-sm">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          {t("catalog.previous")}
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / 25))}
        </span>
        <button
          disabled={(page + 1) * 25 >= (data?.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("catalog.next")}
        </button>
      </div>
      <SchoolFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => void refetch()}
      />
    </div>
  );
}

interface ChildModalProps {
  school: School;
  tab: "bands" | "schedules";
  onClose: () => void;
  onChanged: () => void;
}

interface GradeBand {
  id: string;
  label: string;
  gradeMin: number;
  gradeMax: number;
  note?: string | null;
}
interface Schedule {
  id: string;
  year: number;
  type: "REGULAR" | "ROLLING" | "ED" | "EA" | "OTHER";
  openDate?: string | null;
  closeDate?: string | null;
  testDate?: string | null;
  resultDate?: string | null;
  note?: string | null;
}

export function SchoolChildModal({
  school,
  tab,
  onClose,
  onChanged,
}: ChildModalProps) {
  const { t } = useTranslation("sch");
  const { t: tc } = useTranslation("common");
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<(GradeBand | Schedule)[] | null>(null);
  const [bandForm, setBandForm] = useState<{
    open: boolean;
    initial: Partial<GradeBandFormValue> | null;
  }>({ open: false, initial: null });
  const [schedForm, setSchedForm] = useState<{
    open: boolean;
    initial: Partial<ScheduleFormValue> | null;
  }>({ open: false, initial: null });

  const load = () => {
    const url =
      tab === "bands"
        ? `/acm/sch/schools/${school.id}/grade-bands`
        : `/acm/sch/schools/${school.id}/schedules`;
    apiClient.get(url).then((r) => setItems(r.data ?? []));
  };

  useEffect(load, [school.id, tab]);

  const refreshAll = () => {
    load();
    onChanged();
  };

  const deleteBand = async (b: GradeBand) => {
    const ok = await confirm({
      title: tc("confirm.deleteTitle"),
      description: b.label,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiClient.delete(
        `/acm/sch/schools/${school.id}/grade-bands/${b.id}`,
      );
      toast.success(tc("toast.deleted"));
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message ?? tc("toast.error"));
    }
  };

  const deleteSched = async (sc: Schedule) => {
    const ok = await confirm({
      title: tc("confirm.deleteTitle"),
      description: `${sc.year} ${sc.type}`,
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await apiClient.delete(
        `/acm/sch/schools/${school.id}/schedules/${sc.id}`,
      );
      toast.success(tc("toast.deleted"));
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message ?? tc("toast.error"));
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-lg shadow-lg max-w-3xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold">
            {tab === "bands"
              ? t("gradeBands.title", { school: school.name })
              : t("schedules.title", { school: school.name })}
          </h2>
          <div className="flex items-center gap-2">
            {tab === "bands" && (
              <button
                onClick={() => setBandForm({ open: true, initial: null })}
                className="px-2 py-1 text-sm rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"
              >
                + {t("gradeBands.add")}
              </button>
            )}
            {tab === "schedules" && (
              <button
                onClick={() => setSchedForm({ open: true, initial: null })}
                className="px-2 py-1 text-sm rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"
              >
                + {t("schedules.add")}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary"
            >
              ✕
            </button>
          </div>
        </div>
        {!items && <div className="text-secondary">{t("loading")}</div>}
        {items && items.length === 0 && <div className="text-secondary">—</div>}
        {items && items.length > 0 && tab === "bands" && (
          <ResponsiveTable>
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left">
                <tr>
                  <th className="px-3 py-2">{t("gradeBands.label")}</th>
                  <th className="px-3 py-2">{t("gradeBands.min")}</th>
                  <th className="px-3 py-2">{t("gradeBands.max")}</th>
                  <th className="px-3 py-2">{t("gradeBands.note")}</th>
                  <th className="px-3 py-2">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {(items as GradeBand[]).map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <td className="px-3 py-2">{b.label}</td>
                    <td className="px-3 py-2">{b.gradeMin}</td>
                    <td className="px-3 py-2">{b.gradeMax}</td>
                    <td className="px-3 py-2 text-secondary">
                      {b.note ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setBandForm({ open: true, initial: b })}
                        className="text-blue-600 mr-2"
                      >
                        {t("actions.edit")}
                      </button>
                      <button
                        onClick={() => deleteBand(b)}
                        className="text-red-600"
                      >
                        {t("actions.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
        {items && items.length > 0 && tab === "schedules" && (
          <ResponsiveTable>
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[var(--bg-subtle)] text-left">
                <tr>
                  <th className="px-3 py-2">{t("schedules.year")}</th>
                  <th className="px-3 py-2">{t("schedules.type")}</th>
                  <th className="px-3 py-2">{t("schedules.open")}</th>
                  <th className="px-3 py-2">{t("schedules.close")}</th>
                  <th className="px-3 py-2">{t("schedules.test")}</th>
                  <th className="px-3 py-2">{t("schedules.result")}</th>
                  <th className="px-3 py-2">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {(items as Schedule[]).map((sc) => (
                  <tr
                    key={sc.id}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <td className="px-3 py-2">{sc.year}</td>
                    <td className="px-3 py-2">{sc.type}</td>
                    <td className="px-3 py-2">{sc.openDate ?? "—"}</td>
                    <td className="px-3 py-2">{sc.closeDate ?? "—"}</td>
                    <td className="px-3 py-2">{sc.testDate ?? "—"}</td>
                    <td className="px-3 py-2">{sc.resultDate ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          setSchedForm({ open: true, initial: sc })
                        }
                        className="text-blue-600 mr-2"
                      >
                        {t("actions.edit")}
                      </button>
                      <button
                        onClick={() => deleteSched(sc)}
                        className="text-red-600"
                      >
                        {t("actions.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>

      <GradeBandFormDialog
        open={bandForm.open}
        schoolId={school.id}
        initial={bandForm.initial}
        onClose={() => setBandForm({ open: false, initial: null })}
        onSaved={refreshAll}
      />
      <ScheduleFormDialog
        open={schedForm.open}
        schoolId={school.id}
        initial={schedForm.initial}
        onClose={() => setSchedForm({ open: false, initial: null })}
        onSaved={refreshAll}
      />
    </div>
  );
}
