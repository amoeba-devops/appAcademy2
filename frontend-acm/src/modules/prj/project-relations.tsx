import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Building2, MessageSquare, X } from "lucide-react";
import { useScope, errorText } from "./project-page";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
interface Relation {
  prr_id: string;
  prr_kind: "CLIENT" | "CHAT";
  prr_name: string;
  ref_id: string;
}
export function ProjectRelations({
  project,
  manage,
}: {
  project: string;
  manage: boolean;
}) {
  const scope = useScope(),
    qc = useQueryClient(),
    [kind, setKind] = useState<"CLIENT" | "CHAT" | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const base = `/acm/prj/projects/${project}/relations`;
  const rows = useQuery({
    queryKey: ["prj", project, "relations", ...scope],
    queryFn: async () => (await apiClient.get<Relation[]>(base)).data,
  });
  const channels = useQuery({
    queryKey: ["prj-channels", ...scope],
    enabled: kind === "CHAT",
    queryFn: async () =>
      (
        await apiClient.get<{ id: string; name: string }[]>(
          "/acm/talk/channels",
        )
      ).data,
  });
  async function remove(id: string) {
    if (!confirm("프로젝트 연결을 해제할까요? 원본은 보존됩니다.")) return;
    try {
      await apiClient.delete(`${base}/${id}`);
      await qc.invalidateQueries({ queryKey: ["prj", project, "relations"] });
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {(["CLIENT", "CHAT"] as const).map((k) => (
        <section key={k} className="rounded-xl border bg-surface p-5">
          <header className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              {k === "CLIENT" ? (
                <Building2 size={17} />
              ) : (
                <MessageSquare size={17} />
              )}{" "}
              {k === "CLIENT" ? "배정 고객사" : "관련 채팅방"}
            </h2>
            {manage && (
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                onClick={() => {
                  setKind(k);
                  setName("");
                  setError("");
                }}
              >
                + {k === "CLIENT" ? "고객사 추가" : "채팅방 연결"}
              </button>
            )}
          </header>
          <ul className="mt-4 divide-y">
            {rows.data
              ?.filter((r) => r.prr_kind === k)
              .map((r) => (
                <li className="flex items-center gap-2 py-3" key={r.prr_id}>
                  <span className="min-w-0 flex-1 truncate">
                    {k === "CHAT" ? (
                      <Link
                        className="text-blue-600"
                        to={`/admin/chat?channelId=${r.ref_id}`}
                      >
                        {r.prr_name}
                      </Link>
                    ) : (
                      r.prr_name
                    )}
                  </span>
                  {manage && (
                    <button
                      aria-label={`${r.prr_name} 연결 해제`}
                      onClick={() => void remove(r.prr_id)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </li>
              ))}
          </ul>
          {!rows.isLoading && !rows.data?.some((r) => r.prr_kind === k) && (
            <p className="py-8 text-center text-sm text-gray-400">
              {k === "CLIENT"
                ? "배정된 고객사가 없습니다"
                : "연결된 채팅방이 없습니다"}
            </p>
          )}
          {rows.error && <p role="alert">{errorText(rows.error)}</p>}
        </section>
      ))}
      {kind && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o && !busy) setKind(null);
          }}
        >
          <DialogContent>
            <DialogTitle>
              {kind === "CLIENT" ? "고객사 추가" : "채팅방 연결"}
            </DialogTitle>
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await apiClient.post(base, {
                    kind,
                    name:
                      kind === "CHAT"
                        ? (channels.data?.find((c) => c.id === name)?.name ??
                          "채팅방")
                        : name,
                    refId: kind === "CHAT" ? name : undefined,
                  });
                  await qc.invalidateQueries({
                    queryKey: ["prj", project, "relations"],
                  });
                  setKind(null);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {kind === "CLIENT" ? (
                <label>
                  고객사명
                  <input
                    required
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded border p-2"
                  />
                </label>
              ) : (
                <label>
                  참여 중인 채팅방
                  <select
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded border p-2"
                  >
                    <option value="">선택하세요</option>
                    {channels.data?.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {error && <p role="alert">{error}</p>}
              <button
                disabled={busy || !name.trim()}
                className="rounded bg-blue-600 p-2 text-white"
              >
                {busy ? "저장 중…" : "연결"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
