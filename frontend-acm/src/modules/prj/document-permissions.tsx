import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Item, Project } from "./types";
import { errorText } from "./project-page";
export function DocumentPermissions({
  project,
  item,
}: {
  project: Project;
  item: Item;
}) {
  const [open, setOpen] = useState(false),
    [viewers, setViewers] = useState(item.viewer_ids ?? []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    qc = useQueryClient();
  return (
    <>
      <button
        className="rounded border px-3 py-2 text-sm"
        onClick={() => {
          setViewers(item.viewer_ids ?? []);
          setOpen(true);
        }}
      >
        권한
      </button>
      {open && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!busy) setOpen(o);
          }}
        >
          <DialogContent>
            <DialogTitle>문서 권한</DialogTitle>
            <p className="text-sm">
              ACM 프로젝트 참여자의 편집 권한입니다. Google 원본 공유 권한은
              변경하지 않습니다.
            </p>
            {project.members?.map((m) => (
              <label key={m.id} className="flex justify-between gap-2">
                {m.name}
                <select
                  disabled={m.id === project.owner_id || busy}
                  className="rounded border p-2"
                  value={viewers.includes(m.id) ? "VIEWER" : "EDITOR"}
                  onChange={(e) =>
                    setViewers((v) =>
                      e.target.value === "VIEWER"
                        ? [...v.filter((id) => id !== m.id), m.id]
                        : v.filter((id) => id !== m.id),
                    )
                  }
                >
                  <option value="EDITOR">편집자</option>
                  <option value="VIEWER">뷰어</option>
                </select>
              </label>
            ))}
            {error && <p role="alert">{error}</p>}
            <button
              className="rounded bg-blue-600 p-2 text-white"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiClient.put(
                    `/acm/prj/projects/${project.prj_id}/items/${item.pit_id}/permissions`,
                    { viewers },
                  );
                  await qc.invalidateQueries({ queryKey: ["prj"] });
                  setOpen(false);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              저장
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
