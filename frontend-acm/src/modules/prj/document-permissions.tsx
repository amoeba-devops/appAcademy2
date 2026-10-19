import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t: tp } = useTranslation("prj");
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
        {tp("permissions.button")}
      </button>
      {open && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!busy) setOpen(o);
          }}
        >
          <DialogContent>
            <DialogTitle>{tp("permissions.title")}</DialogTitle>
            <p className="text-sm">
              {tp("permissions.desc")}
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
                  <option value="EDITOR">{tp("documentsPage.editor")}</option>
                  <option value="VIEWER">{tp("documentsPage.viewer")}</option>
                </select>
              </label>
            ))}
            {error && <p role="alert">{error}</p>}
            <button
              className="rounded bg-accent-600 p-2 text-white"
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
              {tp("common.save")}
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
