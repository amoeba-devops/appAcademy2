import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DocumentPermissions } from "./document-permissions";
import { DeleteItemButton } from "./delete-item-button";
import type { Item, Project } from "./types";
import { documentKind } from "./project-overview";
export function DocumentTable({
  items,
  project,
  manage,
  onEdit,
}: {
  items: Item[];
  project: Project;
  manage: boolean;
  onEdit: (i: Item) => void;
}) {
  const { t: tp } = useTranslation("prj");
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user),
    [sort, setSort] = useState("updated"),
    [role, setRole] = useState(""),
    [linked, setLinked] = useState(""),
    [preview, setPreview] = useState<Item | null>(
      () =>
        items.find((i) => i.pit_id === params.get("doc") && i.drive_file_id) ||
        null,
    ),
    [copied, setCopied] = useState("");
  const rows = items
    .filter(
      (i) =>
        (!role ||
          role ===
            (manage || !i.viewer_ids?.includes(user?.id ?? "")
              ? "EDITOR"
              : "VIEWER")) &&
        (!linked ||
          (linked === "yes") === !!(i.drive_file_id || i.external_url)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.pit_title.localeCompare(b.pit_title)
        : sort === "nameDesc"
          ? b.pit_title.localeCompare(a.pit_title)
          : sort === "created"
            ? b.created_at.localeCompare(a.created_at)
            : sort === "oldest"
              ? a.updated_at.localeCompare(b.updated_at)
              : b.updated_at.localeCompare(a.updated_at),
    );
  const url = preview
    ? (preview.external_url ??
      `https://docs.google.com/${documentKind(preview) === "SHEET" ? "spreadsheets" : "document"}/d/${encodeURIComponent(preview.drive_file_id ?? "")}/edit`)
    : "";
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={tp("documentTable.sortLabel")}
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">{tp("documentsPage.sortUpdated")}</option>
          <option value="oldest">{tp("documentsPage.sortOldest")}</option>
          <option value="created">{tp("common.sortRecentCreated")}</option>
          <option value="name">{tp("documentsPage.sortNameAsc")}</option>
          <option value="nameDesc">{tp("documentsPage.sortNameDesc")}</option>
        </select>
        <select
          aria-label={tp("documentTable.permissionLabel")}
          className="rounded border p-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">{tp("documentsPage.allPermissions")}</option>
          <option value="EDITOR">{tp("documentsPage.editor")}</option>
          <option value="VIEWER">{tp("documentsPage.viewer")}</option>
        </select>
        <select
          aria-label={tp("documentTable.googleLinkLabel")}
          className="rounded border p-2"
          value={linked}
          onChange={(e) => setLinked(e.target.value)}
        >
          <option value="">{tp("documentsPage.allLinkStatuses")}</option>
          <option value="yes">{tp("documentsPage.googleLinked")}</option>
          <option value="no">{tp("documentsPage.acmStored")}</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "name",
                "updated",
                "author",
                "permission",
                "googleDoc",
                "actions",
              ].map((c) => (
                <th key={c} className="whitespace-nowrap p-3">
                  {tp(`documentTable.cols.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.pit_id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <button
                    className="text-left text-blue-600"
                    onClick={() =>
                      i.drive_file_id ? setPreview(i) : onEdit(i)
                    }
                  >
                    {i.pit_title}
                  </button>
                </td>
                <td className="whitespace-nowrap p-3">
                  {new Date(i.updated_at).toLocaleString()}
                </td>
                <td className="p-3">{i.creator_name}</td>
                <td className="p-3">
                  {manage || !i.viewer_ids?.includes(user?.id ?? "")
                    ? tp("documentsPage.editor")
                    : tp("documentsPage.viewer")}
                </td>
                <td className="p-3">
                  {i.drive_file_id || i.external_url ? (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
                      {tp("documentTable.linked")}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2"
                      onClick={() =>
                        void navigator.clipboard.writeText(i.pit_id).then(
                          () => setCopied(i.pit_id),
                          () => setCopied("error"),
                        )
                      }
                    >
                      {copied === i.pit_id
                        ? tp("documentsPage.copied")
                        : tp("documentTable.copyId")}
                    </button>
                    {manage && (
                      <DocumentPermissions project={project} item={i} />
                    )}
                    {/* REQ-261019 — 작성자·프로젝트 담당자·테넌트 마스터 */}
                    {project.prj_status !== "ARCHIVED" && (
                      <DeleteItemButton projectId={project.prj_id} item={i} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-secondary">
            {tp("documentTable.noResults")}
          </p>
        )}
      </div>
      {copied === "error" && <p role="alert">{tp("documentTable.copyIdFailed")}</p>}
      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-6xl">
            <DialogTitle>{preview.pit_title}</DialogTitle>
            <div className="flex justify-between gap-3">
              <p className="text-sm text-secondary">
                {tp("documentTable.previewHint")}
              </p>
              <a
                href={url}
                className="shrink-0 text-blue-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                {tp("documentTable.openNewTab")}
              </a>
            </div>
            <iframe
              title={preview.pit_title}
              className="h-[70dvh] w-full border"
              src={url.replace(/\/edit(?=#|$)/, "/preview")}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
