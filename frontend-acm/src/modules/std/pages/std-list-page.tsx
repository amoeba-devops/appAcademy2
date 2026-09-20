import { WithdrawnImportModal } from "../components/withdrawn-import-modal";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { TeacherMultiCombo } from "@/modules/cal/components/teacher-multi-combo";
import type { TeacherDetail } from "@/modules/tch/types";
import { useStudents } from "../hooks/use-students";
import { StdFilters } from "../components/std-filters";
import { StdTable, type StdSort } from "../components/std-table";
import { StdFormModal } from "../components/std-form-modal";
import { StdImportModal } from "../components/std-import-modal";
import { STD_SITES, type StudentCreatePrefill } from "../types";

export function StdListPage() {
  const { t } = useTranslation("std");
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canBulk = role === "ADMIN" || role === "APP_ADMIN";
  const navPrefill = (
    location.state as { studentCreatePrefill?: StudentCreatePrefill } | null
  )?.studentCreatePrefill;
  const [prefill, setPrefill] = useState(navPrefill);
  const [showCreate, setShowCreate] = useState(!!navPrefill);
  const [showImport, setShowImport] = useState(false);
  const [showWithdrawnImport, setShowWithdrawnImport] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newSite, setNewSite] = useState("TPI");
  const [reason, setReason] = useState("");
  const filters = {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "ACTIVE",
    school: params.get("school") ?? "",
    grade: params.get("grade") ?? "",
    showInactive: false,
  };
  const site = ["ALL", "UNASSIGNED", ...STD_SITES].includes(
    params.get("site") ?? "",
  )
    ? params.get("site")!
    : "ALL";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = [25, 50, 100].includes(Number(params.get("limit")))
    ? Number(params.get("limit"))
    : 25;
  const sort: StdSort = {
    field: ["name", "createdAt", "site", "startDate"].includes(
      params.get("sort") ?? "",
    )
      ? (params.get("sort") as StdSort["field"])
      : "createdAt",
    dir: params.get("dir") === "asc" ? "asc" : "desc",
  };
  const change = (values: Record<string, string>, reset = true) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (reset) next.set("page", "1");
    setSelected([]);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (navPrefill)
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
  }, []); // consume navigation prefill only on mount
  const teacherId = params.get("teacherId");
  const teachers = teacherId
    ? [
        {
          id: teacherId,
          name: params.get("teacherName") ?? teacherId,
        } as TeacherDetail,
      ]
    : [];
  const { data, isLoading, isError, refetch } = useStudents({
    q: filters.q || undefined,
    status: filters.status,
    school: filters.school || undefined,
    grade: filters.grade || undefined,
    site,
    page,
    limit,
    sort: sort.field,
    dir: sort.dir,
    teacherId: teacherId || undefined,
    withdrawnDateFrom: params.get("withdrawnDateFrom") || undefined,
    withdrawnDateTo: params.get("withdrawnDateTo") || undefined,
    startDateFrom: params.get("startDateFrom") || undefined,
    startDateTo: params.get("startDateTo") || undefined,
  });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  useEffect(() => {
    if (data && page > pages) change({ page: String(pages) }, false);
  }, [data, page, pages]);
  useEffect(() => {
    setSelected([]);
  }, [location.search]);
  const picked = data?.items.filter((s) => selected.includes(s.id)) ?? [];
  const bulk = useMutation({
    mutationFn: () =>
      apiClient.patch("/acm/std/students/sites", {
        items: picked.map((s) => ({ id: s.id, updatedAt: s.updatedAt })),
        site: newSite,
        reason,
      }),
    onSuccess: () => {
      setBulkOpen(false);
      setSelected([]);
      setReason("");
      qc.invalidateQueries({ queryKey: ["std", "students"] });
    },
  });
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex gap-2">
          {canBulk && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowWithdrawnImport(true)}
              >
                {t("withdrawn.importTitle")}
              </Button>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                {t("actions.import")}
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              setPrefill(
                STD_SITES.includes(site as (typeof STD_SITES)[number])
                  ? { stdSite: site as (typeof STD_SITES)[number] }
                  : undefined,
              );
              setShowCreate(true);
            }}
          >
            {t("actions.create")}
          </Button>
        </div>
      </div>
      <div
        className="mb-4 flex gap-2 overflow-x-auto"
        aria-label={t("site.label")}
      >
        {["ALL", ...STD_SITES, "UNASSIGNED"].map((key) => (
          <Button
            key={key}
            variant={site === key ? "default" : "outline"}
            aria-pressed={site === key}
            onClick={() => change({ site: key })}
            className="whitespace-nowrap"
          >
            {t(`site.${key}`)}{" "}
            ({data?.siteCounts?.[key] ?? "—"})
          </Button>
        ))}
      </div>
      <StdFilters
        value={filters}
        onChange={(next) =>
          change({
            q: next.q,
            status: next.status,
            school: next.school,
            grade: next.grade,
          })
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-48">
          <span className="text-xs">{t("field.teacher")}</span>
          <TeacherMultiCombo
            value={teachers}
            max={1}
            onChange={(next) =>
              change({
                teacherId: next[0]?.id ?? "",
                teacherName: next[0]?.name ?? "",
              })
            }
          />
        </div>
        {(
          [
            "startDateFrom",
            "startDateTo",
            "withdrawnDateFrom",
            "withdrawnDateTo",
          ] as const
        ).map((key) => (
          <label key={key} className="text-xs">
            {key.startsWith("withdrawn") ? t(`withdrawn.${key}`) : t(`site.${key}`)}
            <input
              type="date"
              className="block rounded border p-2 bg-surface"
              value={params.get(key) ?? ""}
              onChange={(e) => change({ [key]: e.target.value })}
            />
          </label>
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            setParams({});
            setSelected([]);
          }}
        >
          {t("site.reset")}
        </Button>
      </div>
      <div className="mb-3 flex justify-between">
        <p>{t("table.total", { count: data?.total ?? 0 })}</p>
        {canBulk && (
          <Button
            variant="outline"
            disabled={!picked.length}
            onClick={() => {
              bulk.reset();
              setBulkOpen(true);
            }}
          >
            {t("site.change")} ({picked.length})
          </Button>
        )}
      </div>
      {isError ? (
        <div role="alert">
          {t("site.loadError")}{" "}
          <Button onClick={() => refetch()}>{t("site.retry")}</Button>
        </div>
      ) : (
        <StdTable
          showWithdrawal={filters.status === "WITHDRAWN"}
          items={data?.items ?? []}
          isLoading={isLoading}
          sort={sort}
          onSort={(field) =>
            change({
              sort: field,
              dir: sort.field === field && sort.dir === "asc" ? "desc" : "asc",
            })
          }
          offset={(page - 1) * limit}
          selected={selected}
          onSelect={
            canBulk
              ? (id) =>
                  setSelected((ids) =>
                    ids.includes(id)
                      ? ids.filter((x) => x !== id)
                      : [...ids, id],
                  )
              : undefined
          }
        />
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        <select
          aria-label={t("site.pageSize")}
          value={limit}
          onChange={(e) => change({ limit: e.target.value })}
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => change({ page: String(page - 1) }, false)}
        >
          {t("site.previous")}
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          disabled={page >= pages}
          onClick={() => change({ page: String(page + 1) }, false)}
        >
          {t("site.next")}
        </Button>
      </div>
      {showCreate && (
        <StdFormModal
          open
          onClose={() => setShowCreate(false)}
          prefill={prefill}
        />
      )}
      {showWithdrawnImport && (
        <WithdrawnImportModal
          open
          onClose={() => setShowWithdrawnImport(false)}
        />
      )}
      {showImport && (
        <StdImportModal open onClose={() => setShowImport(false)} />
      )}
      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => !bulk.isPending && setBulkOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("site.change")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{t("site.review")}</p>
          <select
            aria-label={t("site.label")}
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
          >
            {STD_SITES.map((s) => (
              <option key={s} value={s}>
                {t(`site.${s}`)}
              </option>
            ))}
          </select>
          <ul className="max-h-64 overflow-y-auto text-sm">
            {picked.map((s) => (
              <li key={s.id}>
                {s.name}: {t(`site.${s.site ?? "UNASSIGNED"}`)} →{" "}
                {t(`site.${newSite}`)}
              </li>
            ))}
          </ul>
          <label>
            {t("site.reason")}
            <input
              className="w-full rounded border p-2"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {bulk.isError && <p role="alert">{t("site.saveError")}</p>}
          <Button
            disabled={!reason.trim() || bulk.isPending || !picked.length}
            onClick={() => bulk.mutate()}
          >
            {t("site.apply")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
