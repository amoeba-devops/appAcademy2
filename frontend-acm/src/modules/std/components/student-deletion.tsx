import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const BASE = "/acm/std/deletion";
interface Preview {
  student: { id: string; name: string; archivedAt: string | null };
  counts: Record<string, number>;
  blocked: string[];
  version: string;
  inquiryIds: string[];
  eventIds: string[];
}
interface Row {
  id: string;
  name: string;
  actorName: string;
  actorId?: string;
  occurredAt: string;
  action?: string;
  counts?: Record<string, number>;
}
export function useStudentDeletionAccess() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["std-deletion-access", user?.id],
    queryFn: async () =>
      (await apiClient.get<{ canDelete: boolean }>(`${BASE}/access`)).data,
    enabled: !!user,
    staleTime: 0,
  });
}
export function StudentDeletionLinks() {
  const { data } = useStudentDeletionAccess();
  const { t } = useTranslation("std");
  if (!data?.canDelete) return null;
  return (
    <>
      <Link className="block px-3 py-2 text-sm" to="/admin/std/archived">
        {t("deletion.archived")}
      </Link>
      <Link
        className="block px-3 py-2 text-sm"
        to="/admin/std/deletion-history"
      >
        {t("deletion.history")}
      </Link>
    </>
  );
}
export function StudentDeleteButton({ id }: { id: string }) {
  const { data } = useStudentDeletionAccess();
  const { t } = useTranslation("std");
  const [open, setOpen] = useState(false);
  return data?.canDelete ? (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t("deletion.delete")}
      </Button>
      {open && (
        <DeletionDialog id={id} purge={false} onClose={() => setOpen(false)} />
      )}
    </>
  ) : null;
}
function DeletionDialog({
  id,
  purge,
  onClose,
}: {
  id: string;
  purge: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("std"),
    navigate = useNavigate(),
    qc = useQueryClient();
  const [name, setName] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const preview = useQuery({
    queryKey: ["std-deletion-preview", id],
    queryFn: async () =>
      (await apiClient.get<Preview>(`${BASE}/${id}/preview`)).data,
    staleTime: 0,
  });
  const p = preview.data;
  const mutation = useMutation({
    mutationFn: async () => {
      if (!p) throw new Error("No preview");
      if (purge)
        await apiClient.post(`${BASE}/${id}/purge`, {
          name,
          testConfirmed: confirmed,
          version: p.version,
        });
      else await apiClient.delete(`/acm/std/students/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      onClose();
      navigate("/admin/std/archived");
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t(purge ? "deletion.purge" : "deletion.delete")}
          </DialogTitle>
        </DialogHeader>
        <p
          className={
            purge ? "text-red-700 whitespace-pre-line" : "whitespace-pre-line"
          }
        >
          {t(purge ? "deletion.warning" : "deletion.archiveNotice")}
        </p>
        {preview.isPending && <p>{t("common:status.loading")}</p>}
        {preview.isError && <p role="alert">{t("deletion.loadError")}</p>}
        {p && (
          <>
            <strong>{p.student.name}</strong>
            <dl className="grid grid-cols-2 gap-2">
              {Object.entries(p.counts).map(([k, v]) => (
                <div key={k}>
                  <dt>{t(`deletion.counts.${k}`)}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="max-h-32 overflow-auto space-y-1">
              {p.inquiryIds.map((x, i) => (
                <Link
                  className="block underline"
                  key={x}
                  to={`/admin/csl/${x}`}
                >
                  {t("deletion.counts.consultations")} {i + 1}
                </Link>
              ))}
              {p.eventIds.map((x, i) => (
                <Link
                  className="block underline"
                  key={x}
                  to={`/admin/cal/${x}`}
                >
                  {t("deletion.counts.events")} {i + 1}
                </Link>
              ))}
            </div>
            {purge && (
              <>
                {p.blocked.map((b) => (
                  <p role="alert" className="text-red-700" key={b}>
                    {t(`deletion.blocked.${b}`)}
                  </p>
                ))}
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    disabled={mutation.isPending}
                  />
                  {t("deletion.confirmTest")}
                </label>
                <label>
                  {t("deletion.typeName")}
                  <input
                    className="mt-1 w-full rounded border p-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    disabled={mutation.isPending}
                  />
                </label>
              </>
            )}
          </>
        )}
        {mutation.isError && (
          <p role="alert" className="text-red-700">
            {t("deletion.actionError")}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {t("deletion.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={
              !p ||
              preview.isFetching ||
              mutation.isPending ||
              (purge &&
                (!p.student.archivedAt ||
                  !confirmed ||
                  name !== p.student.name ||
                  p.blocked.length > 0))
            }
            onClick={() => mutation.mutate()}
          >
            {t(purge ? "deletion.purge" : "deletion.archive")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function StudentDeletionPage({
  history = false,
}: {
  history?: boolean;
}) {
  const access = useStudentDeletionAccess(),
    { t } = useTranslation("std");
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ["std-deletion-list", user?.id, history, page],
    queryFn: async () =>
      (
        await apiClient.get<{ items: Row[]; total: number }>(
          `${BASE}/${history ? "history" : "archived"}?page=${page}`,
        )
      ).data,
    enabled: access.data?.canDelete === true,
  });
  if (access.isPending) return <p>{t("common:status.loading")}</p>;
  if (!access.data?.canDelete)
    return <p role="alert">{t("deletion.forbidden")}</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {t(history ? "deletion.history" : "deletion.archived")}
      </h1>
      <nav className="flex flex-wrap gap-4">
        <Link to="/admin/std">{t("detail.back")}</Link>
        <Link
          to={history ? "/admin/std/archived" : "/admin/std/deletion-history"}
        >
          {t(history ? "deletion.archived" : "deletion.history")}
        </Link>
      </nav>
      {query.isError && <p role="alert">{t("deletion.loadError")}</p>}
      {query.isPending && <p>{t("common:status.loading")}</p>}
      {!query.isPending && !query.isError && query.data?.items.length === 0 && (
        <p>{t("deletion.empty")}</p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {["student", "date", "actor", history ? "action" : "manage"].map(
                (k) => (
                  <th className="text-left p-3" key={k}>
                    {t(`deletion.${k}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((r) => (
              <tr className="border-t" key={r.id}>
                <td className="p-3">{r.name}</td>
                <td className="p-3 whitespace-nowrap">
                  {new Date(r.occurredAt).toLocaleString()}
                </td>
                <td className="p-3" title={r.actorId}>
                  {r.actorName}
                </td>
                <td className="p-3">
                  {history ? (
                    <>
                      <span>
                        {t(
                          r.action === "PURGE"
                            ? "deletion.purge"
                            : "deletion.archive",
                        )}
                      </span>
                      {r.counts &&
                        Object.entries(r.counts).map(([k, v]) => (
                          <div key={k}>
                            {t(`deletion.counts.${k}`)}: {v}
                          </div>
                        ))}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(r.id)}
                    >
                      {t("deletion.review")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 items-center">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          {t("deletion.previous")}
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil((query.data?.total ?? 0) / 50))}
        </span>
        <Button
          variant="outline"
          disabled={page * 50 >= (query.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          {t("deletion.next")}
        </Button>
      </div>
      {selected && (
        <DeletionDialog id={selected} purge onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
