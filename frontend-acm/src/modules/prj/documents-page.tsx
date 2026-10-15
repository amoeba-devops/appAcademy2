import { phases } from "./project-files";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useScope, errorText } from "./project-page";
import { documentKind } from "./project-overview";
import type { Item, Project } from "./types";
export function DocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState("");
  const [phase, setPhase] = useState("");
  const scope = useScope(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("updated"),
    [share, setShare] = useState(""),
    [project, setProject] = useState("");
  const tab = params.get("tab") ?? "memo";
  const kind =
    tab === "spreadsheet"
      ? "SHEET"
      : tab === "gdoc"
        ? "DOC"
        : tab === "files"
          ? "FILE"
          : "MEMO";
  const q = useQuery({
    queryKey: ["prj", "documents", ...scope],
    queryFn: async () =>
      (
        await apiClient.get<(Item & { prj_id: string; prj_title: string })[]>(
          "/acm/prj/documents",
        )
      ).data,
  });
  const projects = useQuery({
    queryKey: ["prj", "list", ...scope],
    queryFn: async () =>
      (await apiClient.get<Project[]>("/acm/prj/projects")).data,
  });
  const rows = (q.data ?? [])
    .filter(
      (i) =>
        documentKind(i) === kind &&
        (!phase || kind !== "FILE" || i.file_phase === phase) &&
        (!role ||
          role ===
            (i.viewer_ids?.includes(user?.id ?? "") &&
            projects.data?.find((p) => p.prj_id === i.prj_id)?.owner_id !==
              user?.id
              ? "VIEWER"
              : "EDITOR")) &&
        (!project || i.prj_id === project) &&
        `${i.pit_title} ${i.prj_title} ${i.creator_name}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!share ||
          (share === "linked") === !!(i.external_url || i.drive_file_id)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.pit_title.localeCompare(b.pit_title)
        : sort === "nameDesc"
          ? b.pit_title.localeCompare(a.pit_title)
          : sort === "downloads"
            ? (b.download_count ?? 0) - (a.download_count ?? 0)
            : sort === "size"
              ? Number(b.drive_size ?? 0) - Number(a.drive_size ?? 0)
              : sort === "created"
                ? b.created_at.localeCompare(a.created_at)
                : sort === "oldest"
                  ? a.updated_at.localeCompare(b.updated_at)
                  : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <section className="grid min-w-0 gap-5">
      <h1 className="text-2xl font-semibold">문서</h1>
      <nav className="flex overflow-auto border-b">
        {[
          ["memo", "메모"],
          ["spreadsheet", "시트(스프레드시트)"],
          ["gdoc", "문서(Docs)"],
          ["files", "파일"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`shrink-0 border-b-2 px-5 py-3 ${tab === key ? "border-blue-600 text-blue-600" : "border-transparent"}`}
            onClick={() => setParams({ tab: key })}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Permission"
          className="rounded border p-2"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">전체 권한</option>
          <option value="EDITOR">편집자</option>
          <option value="VIEWER">뷰어</option>
        </select>
        {kind === "FILE" && (
          <select
            aria-label="Phase"
            className="rounded border p-2"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          >
            <option value="">전체 단계</option>
            {Object.entries(phases).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        <input
          className="min-w-0 rounded border p-2"
          aria-label="문서 검색"
          placeholder="제목·프로젝트·작성자 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="정렬"
          className="rounded border p-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">최근 수정순</option>
          <option value="oldest">오래된 수정순</option>
          <option value="created">최근 등록순</option>
          <option value="name">이름 오름차순</option>
          <option value="nameDesc">이름 내림차순</option>
          {kind === "FILE" && (
            <>
              <option value="size">크기순</option>
              <option value="downloads">다운로드 수순</option>
            </>
          )}
        </select>
        <select
          aria-label="프로젝트"
          className="rounded border p-2"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">전체 프로젝트</option>
          {projects.data?.map((p) => (
            <option key={p.prj_id} value={p.prj_id}>
              {p.prj_title}
            </option>
          ))}
        </select>
        <select
          aria-label="연동 상태"
          className="rounded border p-2"
          value={share}
          onChange={(e) => setShare(e.target.value)}
        >
          <option value="">전체 연동 상태</option>
          <option value="linked">Google 연동</option>
          <option value="local">ACM 저장</option>
        </select>
        {project && (
          <Link
            className="rounded bg-blue-600 p-2 text-white"
            to={`/admin/projects/${project}?tab=documents&type=${kind.toLowerCase()}&create=1`}
          >
            + 작성
          </Link>
        )}
      </div>
      {!project && (
        <p className="text-sm text-secondary">작성할 프로젝트를 선택하세요.</p>
      )}
      {q.error && <p role="alert">{errorText(q.error)}</p>}
      <div className="overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {[
                "문서명",
                "프로젝트",
                "최종 수정",
                "작성자",
                kind === "FILE" ? "크기" : "저장 방식",
                "작업",
              ].map((h) => (
                <th className="whitespace-nowrap px-4 py-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr className="border-b hover:bg-gray-50" key={i.pit_id}>
                <td className="max-w-xs px-4 py-3">
                  <Link
                    className="text-blue-600"
                    to={`/admin/projects/${i.prj_id}?tab=documents&type=${kind.toLowerCase()}&doc=${i.pit_id}`}
                  >
                    {i.pit_title}
                  </Link>
                </td>
                <td className="px-4 py-3">{i.prj_title}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {new Date(i.updated_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">{i.creator_name}</td>
                <td className="px-4 py-3">
                  {kind === "FILE"
                    ? `${Math.ceil(Number(i.drive_size ?? 0) / 1024)}KB`
                    : i.external_url || i.drive_file_id
                      ? "Google 연동"
                      : "ACM 문서"}
                </td>
                <td className="px-4 py-3">
                  <CopyId id={i.pit_id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-12 text-center text-secondary">
            {q.isLoading ? "불러오는 중…" : "등록된 항목이 없습니다."}
          </p>
        )}
      </div>
    </section>
  );
}
function CopyId({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  return (
    <button
      onClick={() =>
        void navigator.clipboard.writeText(id).then(
          () => setMessage("복사 완료"),
          () => setMessage("복사 실패"),
        )
      }
    >
      {message || "문서 ID 복사"}
    </button>
  );
}
