import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DocumentPermissions } from "./document-permissions";
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
          aria-label="문서 정렬"
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">최근 수정순</option>
          <option value="oldest">오래된 수정순</option>
          <option value="created">최근 등록순</option>
          <option value="name">이름 오름차순</option>
          <option value="nameDesc">이름 내림차순</option>
        </select>
        <select
          aria-label="문서 권한"
          className="rounded border p-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">전체 권한</option>
          <option value="EDITOR">편집자</option>
          <option value="VIEWER">뷰어</option>
        </select>
        <select
          aria-label="Google 연동"
          className="rounded border p-2"
          value={linked}
          onChange={(e) => setLinked(e.target.value)}
        >
          <option value="">전체 연동 상태</option>
          <option value="yes">Google 연동</option>
          <option value="no">ACM 저장</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "문서명",
                "최종 수정",
                "작성자",
                "권한",
                "Google 문서",
                "작업",
              ].map((t) => (
                <th key={t} className="whitespace-nowrap p-3">
                  {t}
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
                    ? "편집자"
                    : "뷰어"}
                </td>
                <td className="p-3">
                  {i.drive_file_id || i.external_url ? (
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
                      연동
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
                      {copied === i.pit_id ? "복사 완료" : "ID 복사"}
                    </button>
                    {manage && (
                      <DocumentPermissions project={project} item={i} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-secondary">
            검색 결과가 없습니다.
          </p>
        )}
      </div>
      {copied === "error" && <p role="alert">ID를 복사하지 못했습니다.</p>}
      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-6xl">
            <DialogTitle>{preview.pit_title}</DialogTitle>
            <div className="flex justify-between gap-3">
              <p className="text-sm text-secondary">
                미리보기가 표시되지 않으면 Google 원본 접근 권한을 확인하세요.
              </p>
              <a
                href={url}
                className="shrink-0 text-blue-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                새 탭 열기
              </a>
            </div>
            <iframe
              title={preview.pit_title}
              className="h-[70dvh] w-full border"
              src={url.replace(/\/edit$/, "/preview")}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
