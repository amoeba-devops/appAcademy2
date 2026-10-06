import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComplaintDialog } from "../components/complaint-dialog";
import type { Complaint } from "../types/complaint";

export function ComplaintsPage() {
  const { t } = useTranslation("dsh");
  const [params, setParams] = useSearchParams();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const filters = {
    from: params.get("from") ?? `${today.slice(0, 7)}-01`,
    to: params.get("to") ?? today,
    site: params.get("site") ?? "ALL",
    channel: params.get("channel") ?? "",
    severity: params.get("severity") ?? "",
    search: params.get("search") ?? "",
  };
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(filters.search);
  useEffect(() => setSearch(filters.search), [filters.search]);
  const [editing, setEditing] = useState<Complaint>();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [warning, setWarning] = useState(false);
  const valid =
    !!filters.from &&
    !!filters.to &&
    filters.from <= filters.to &&
    (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000 <= 365;
  function change(key: string, value: string) {
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set(key, value);
      next.delete("page");
      return next;
    });
  }
  const list = useQuery({
    queryKey: ["dsh", "complaints", filters, page],
    enabled: valid,
    queryFn: async () =>
      (
        await apiClient.get<{ items: Complaint[]; total: number }>(
          "/acm/dsh/complaints/search",
          {
            params: {
              ...filters,
              channel: filters.channel || undefined,
              severity: filters.severity || undefined,
              page,
              limit: 20,
            },
          },
        )
      ).data,
  });
  const detail = useQuery({
    queryKey: ["dsh", "complaints", "detail", detailId],
    enabled: !!detailId,
    queryFn: async () =>
      (await apiClient.get<Complaint>(`/acm/dsh/complaints/${detailId}`)).data,
  });
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("complaint.manage.title")}</h1>
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          {t("actions.addComplaint")}
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          change("search", search);
        }}
      >
        {(["from", "to"] as const).map((key) => (
          <label key={key} className="text-sm">
            {t(`range.${key}`)}
            <Input
              type="date"
              value={filters[key]}
              onChange={(e) => change(key, e.target.value)}
            />
          </label>
        ))}
        {(
          [
            ["site", ["ALL", "COMMON", "TPI", "TRINITY", "SANTACROCE"]],
            ["channel", ["", "PHONE", "EMAIL", "CHAT", "IN_PERSON", "OTHER"]],
            ["severity", ["", "LOW", "MEDIUM", "HIGH"]],
          ] as const
        ).map(([key, options]) => (
          <label className="text-sm" key={key}>
            {t(`complaint.${key}`)}
            <select
              className="block h-9 rounded-md border bg-surface px-3"
              value={filters[key]}
              onChange={(e) => change(key, e.target.value)}
            >
              {options.map((value) => (
                <option key={value} value={value}>
                  {value
                    ? t(
                        key === "site"
                          ? `site.tabs.${value}`
                          : `complaint.${key === "channel" ? "channels" : "severities"}.${value}`,
                      )
                    : t("complaint.manage.all")}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Input
          className="w-60"
          aria-label={t("complaint.manage.search")}
          placeholder={t("complaint.manage.search")}
          maxLength={200}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          {t("complaint.manage.searchButton")}
        </Button>
      </form>
      {!valid && <p role="alert">{t("complaint.manage.invalidRange")}</p>}
      {warning && (
        <p role="status">{t("complaint.manage.statisticsPending")}</p>
      )}
      {list.isError && (
        <div role="alert">
          {t("complaint.manage.loadError")}{" "}
          <Button variant="outline" onClick={() => list.refetch()}>
            {t("complaint.manage.retry")}
          </Button>
        </div>
      )}
      {list.isLoading && <p role="status">{t("complaint.manage.loading")}</p>}
      {list.data && valid && (
        <>
          <p className="text-sm text-secondary">
            {t("complaint.manage.total", { count: list.data.total })}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-surface">
                <tr>
                  {[
                    "date",
                    "site",
                    "channel",
                    "severity",
                    "subject",
                    "description",
                  ].map((key) => (
                    <th key={key} className="p-3">
                      {t(`complaint.${key}`)}
                    </th>
                  ))}
                  <th className="p-3">{t("complaint.manage.updated")}</th>
                  <th className="p-3">{t("complaint.manage.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="whitespace-nowrap p-3">{item.date}</td>
                    <td className="p-3">
                      {t(`site.tabs.${item.site ?? "COMMON"}`)}
                    </td>
                    <td className="p-3">
                      {t(`complaint.channels.${item.channel}`)}
                    </td>
                    <td className="p-3">
                      {t(`complaint.severities.${item.severity}`)}
                    </td>
                    <td className="max-w-60 p-3">
                      <button
                        className="text-left underline"
                        onClick={() => setDetailId(item.id)}
                      >
                        {item.subject || t("complaint.manage.untitled")}
                      </button>
                    </td>
                    <td className="max-w-72 p-3">
                      <p className="line-clamp-2 whitespace-pre-wrap">
                        {item.description || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap p-3">
                      {new Date(item.updatedAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(item);
                          setOpen(true);
                        }}
                      >
                        {t("complaint.manage.edit")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && (
              <p className="p-8 text-center">{t("complaint.manage.empty")}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() =>
                setParams((old) => {
                  const next = new URLSearchParams(old);
                  next.set("page", String(page - 1));
                  return next;
                })
              }
            >
              {t("complaint.manage.previous")}
            </Button>
            <span>
              {page} / {Math.max(1, Math.ceil(list.data.total / 20))}
            </span>
            <Button
              variant="outline"
              disabled={page * 20 >= list.data.total}
              onClick={() =>
                setParams((old) => {
                  const next = new URLSearchParams(old);
                  next.set("page", String(page + 1));
                  return next;
                })
              }
            >
              {t("complaint.manage.next")}
            </Button>
          </div>
          <p className="text-xs text-secondary">
            {t("complaint.manage.manualNote")}
          </p>
        </>
      )}
      <Dialog
        open={!!detailId}
        onOpenChange={(value) => {
          if (!value) setDetailId(undefined);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("complaint.manage.detail")}</DialogTitle>
          </DialogHeader>
          {detail.isLoading && <p>{t("complaint.manage.loading")}</p>}
          {detail.isError && (
            <p role="alert">{t("complaint.manage.loadError")}</p>
          )}
          {detail.data && (
            <div className="space-y-3">
              <p>
                {detail.data.date} ·{" "}
                {t(`site.tabs.${detail.data.site ?? "COMMON"}`)} ·{" "}
                {t(`complaint.channels.${detail.data.channel}`)} ·{" "}
                {t(`complaint.severities.${detail.data.severity}`)}
              </p>
              <h2 className="font-semibold">
                {detail.data.subject || t("complaint.manage.untitled")}
              </h2>
              <p className="whitespace-pre-wrap break-words">
                {detail.data.description || "—"}
              </p>
              {detail.data.linkedQnaId && (
                <a className="underline" href="/admin/qna">
                  {t("complaint.manage.currentLink")}
                </a>
              )}
              <p className="text-xs">
                {t("complaint.manage.created")}:{" "}
                {new Date(detail.data.createdAt).toLocaleString()}
                <br />
                {t("complaint.manage.updated")}:{" "}
                {new Date(detail.data.updatedAt).toLocaleString()}
              </p>
              <Button
                onClick={() => {
                  setEditing(detail.data);
                  setDetailId(undefined);
                  setOpen(true);
                }}
              >
                {t("complaint.manage.edit")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ComplaintDialog
        open={open}
        onOpenChange={setOpen}
        yearMonth={filters.from.slice(0, 7)}
        complaint={editing}
        onSaved={setWarning}
        initialSite={
          ["TPI", "TRINITY", "SANTACROCE"].includes(filters.site)
            ? (filters.site as NonNullable<Complaint["site"]>)
            : undefined
        }
      />
    </div>
  );
}
