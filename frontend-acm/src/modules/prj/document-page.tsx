import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { DocumentEditor, type DocumentType } from "./document-editor";
import { errorText, useScope } from "./project-page";
import type { Item, Project } from "./types";
const base = "/acm/prj";
const docTypes = ["MEMO", "SHEET", "DOC"];
export function projectDocumentPath(
  project: string,
  doc: string,
  type?: string,
  mode?: "LOCAL" | "GOOGLE_LINK",
) {
  const q = new URLSearchParams();
  if (type) q.set("type", type.toLowerCase());
  if (mode) q.set("mode", mode);
  const qs = q.toString();
  return `/admin/projects/${project}/documents/${doc}${qs ? "?" + qs : ""}`;
}
export function ProjectDocumentPage() {
  const { id = "", docId = "" } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    user = useAuthStore((s) => s.user),
    scope = useScope();
  const p = useQuery({
    queryKey: ["prj", id, ...scope],
    queryFn: async () =>
      (await apiClient.get<Project>(base + "/projects/" + id)).data,
  });
  const items = useQuery({
    queryKey: ["prj", id, "items", ...scope],
    queryFn: async () =>
      (await apiClient.get<Item[]>(base + "/projects/" + id + "/items")).data,
  });
  const isNew = docId === "new",
    item = isNew ? undefined : items.data?.find((i) => i.pit_id === docId),
    requested = (params.get("type") ?? "memo").toUpperCase(),
    type = (
      item?.document_type && docTypes.includes(item.document_type)
        ? item.document_type
        : docTypes.includes(requested)
          ? requested
          : "MEMO"
    ) as DocumentType,
    mode = params.get("mode") === "GOOGLE_LINK" ? "GOOGLE_LINK" : "LOCAL";
  const back = () =>
    navigate(
      `/admin/projects/${id}?tab=documents&type=${type.toLowerCase()}`,
    );
  if (p.isLoading || items.isLoading) return <p>불러오는 중…</p>;
  if (!p.data || p.error || items.error)
    return (
      <p role="alert">
        {p.error || items.error
          ? errorText(p.error ?? items.error)
          : "프로젝트가 없습니다."}
      </p>
    );
  if (!isNew && (!item || item.drive_file_id || item.pit_kind === "FILE"))
    return <p role="alert">문서를 찾을 수 없습니다.</p>;
  const project = p.data,
    manage = project.can_manage ?? project.owner_id === user?.id,
    readOnly =
      project.prj_status === "ARCHIVED" ||
      (isNew
        ? false
        : !manage && !!item?.viewer_ids?.includes(user?.id ?? ""));
  return (
    <div className="grid min-w-0 gap-3">
      <p className="truncate text-sm text-secondary">
        {project.prj_title} › 문서
      </p>
      <DocumentEditor
        key={docId}
        project={id}
        item={item}
        type={type}
        initialMode={mode}
        readOnly={readOnly}
        close={back}
      />
    </div>
  );
}
