import { driveOperation } from "./drive-operation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveConnection, errorText, useScope, useWork } from "./project-page";
import { pickGoogle } from "./google-picker";
import type { DriveStatus, DriveFile, Person } from "./types";
interface Folder {
  drf_id: string;
  title: string;
  file_id: string;
  operator_access: string;
  access: "VIEW" | "EDIT";
}
const base = "/acm/drive/folders";
export function SharedDrivePage() {
  const scope = useScope(),
    qc = useQueryClient(),
    w = useWork();
  const [manage, setManage] = useState(false),
    [folder, setFolder] = useState<Folder | null>(null),
    [permissions, setPermissions] = useState<Folder | "new" | null>(null),
    [search, setSearch] = useState(""),
    [cards, setCards] = useState(true);
  const status = useQuery({
    queryKey: ["prj-drive", ...scope],
    queryFn: async () =>
      (await apiClient.get<DriveStatus>("/acm/prj/drive")).data,
  });
  const folders = useQuery({
    queryKey: ["shared-drive", ...scope],
    queryFn: async () => (await apiClient.get<Folder[]>(base)).data,
  });
  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-xl font-bold">드라이브</h1>
        <Button variant="outline" onClick={() => setManage(!manage)}>
          연결 관리
        </Button>
      </div>
      <p>
        {status.data?.connected
          ? `학원 공용 계정: ${status.data.email}`
          : "Google Drive 계정이 연결되지 않았습니다."}
      </p>
      {(manage || !status.data?.connected) && <DriveConnection />}
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          aria-label="폴더 검색"
          placeholder="공용 폴더 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" onClick={() => setCards(!cards)}>
          {cards ? "목록 보기" : "카드 보기"}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void qc.invalidateQueries({ queryKey: ["shared-drive"] })
          }
        >
          새로고침
        </Button>
        {status.data?.canManage && (
          <Button
            disabled={!status.data.connected}
            onClick={() => setPermissions("new")}
          >
            폴더 연결
          </Button>
        )}
      </div>
      {(w.error || folders.error) && (
        <p role="alert" className="text-red-600">
          {w.error || errorText(folders.error)}
        </p>
      )}
      {folders.isLoading ? (
        <p>불러오는 중…</p>
      ) : !folders.data?.length ? (
        <p>
          연결된 공용 폴더가 없습니다. 설정 관리자가 폴더를 연결하고 열람·편집
          대상을 지정할 수 있습니다.
        </p>
      ) : (
        <div
          className={`grid gap-3 ${cards ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}
        >
          {folders.data
            .filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
            .map((f) => (
              <article
                key={f.drf_id}
                className="min-w-0 rounded-lg border bg-surface p-4"
              >
                <h2 className="break-words font-semibold">{f.title}</h2>
                <p className="text-xs">
                  {f.access === "EDIT" ? "편집 가능" : "읽기 전용"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setFolder(f)}>열기</Button>
                  {status.data?.canManage && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setPermissions(f)}
                      >
                        공유 대상
                      </Button>
                      <Button
                        variant="outline"
                        disabled={w.busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "ACM에서 연결을 해제할까요? Google 원본은 보존됩니다.",
                            )
                          )
                            void w.run(async () => {
                              await apiClient.delete(`${base}/${f.drf_id}`);
                              await qc.invalidateQueries({
                                queryKey: ["shared-drive"],
                              });
                            });
                        }}
                      >
                        연결 해제
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
      {permissions && (
        <FolderPermissions
          folder={permissions === "new" ? undefined : permissions}
          close={() => setPermissions(null)}
        />
      )}
      {folder && (
        <SharedBrowser folder={folder} close={() => setFolder(null)} />
      )}
    </section>
  );
}
function FolderPermissions({
  folder,
  close,
}: {
  folder?: Folder;
  close: () => void;
}) {
  const scope = useScope(),
    qc = useQueryClient(),
    w = useWork();
  const [fileId, setFileId] = useState(folder?.file_id ?? ""),
    [operatorAccess, setOperatorAccess] = useState(
      folder?.operator_access ?? "NONE",
    ),
    [choices, setChoices] = useState<Record<string, string> | null>(null);
  const people = useQuery({
    queryKey: ["prj-people", ...scope],
    queryFn: async () =>
      (await apiClient.get<Person[]>("/acm/prj/people")).data,
  });
  const members = useQuery({
    queryKey: ["shared-drive", folder?.drf_id, "permissions", ...scope],
    enabled: !!folder,
    queryFn: async () =>
      (
        await apiClient.get<{ usr_id: string; access: string }[]>(
          `${base}/${folder!.drf_id}/permissions`,
        )
      ).data,
  });
  const selected =
    choices ??
    Object.fromEntries((members.data ?? []).map((m) => [m.usr_id, m.access]));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !w.busy) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>공용 폴더 · 공유 대상</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          프로젝트 자료와 겹치지 않는 폴더를 연결하세요. Google 공유 권한은
          변경하지 않습니다.
        </p>
        <Button
          variant="outline"
          disabled={w.busy || !!folder}
          onClick={() =>
            void w.run(async () => {
              const id = await pickGoogle(true);
              if (id) setFileId(id);
            })
          }
        >
          {fileId ? "폴더 선택됨" : "Google 폴더 선택"}
        </Button>
        <label>
          학원 운영자 (관리자·직원)
          <select
            className="w-full rounded border p-2"
            value={operatorAccess}
            onChange={(e) => setOperatorAccess(e.target.value)}
          >
            <option value="NONE">공유 안 함</option>
            <option value="VIEW">열람</option>
            <option value="EDIT">편집</option>
          </select>
        </label>
        <div className="max-h-64 overflow-auto">
          {people.data?.map((p) => (
            <label key={p.id} className="flex justify-between gap-2 py-2">
              {p.name}
              <select
                className="rounded border p-2"
                value={selected[p.id] ?? "NONE"}
                onChange={(e) =>
                  setChoices({ ...selected, [p.id]: e.target.value })
                }
              >
                <option value="NONE">지정 안 함</option>
                <option value="VIEW">열람</option>
                <option value="EDIT">편집</option>
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs">
          설정 관리자는 연결 및 공유 대상을 관리할 수 있습니다. 운영자 권한과
          개인 권한 중 높은 권한이 적용됩니다.
        </p>
        {(w.error || members.error || people.error) && (
          <p role="alert" className="text-red-600">
            {w.error || errorText(members.error || people.error)}
          </p>
        )}
        <Button
          disabled={
            w.busy ||
            !fileId ||
            people.isLoading ||
            !!people.error ||
            !!members.error ||
            (!!folder && members.isLoading)
          }
          onClick={() =>
            void w.run(async () => {
              await apiClient.post(base, {
                fileId,
                operatorAccess,
                viewers: Object.keys(selected).filter(
                  (k) => selected[k] === "VIEW",
                ),
                editors: Object.keys(selected).filter(
                  (k) => selected[k] === "EDIT",
                ),
              });
              await qc.invalidateQueries({ queryKey: ["shared-drive"] });
              close();
            })
          }
        >
          저장
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function SharedBrowser({
  folder,
  close,
}: {
  folder: Folder;
  close: () => void;
}) {
  const scope = useScope(),
    w = useWork();
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([
      { id: folder.file_id, name: folder.title },
    ]),
    [page, setPage] = useState<string | undefined>(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("name"),
    [desc, setDesc] = useState(false),
    [cards, setCards] = useState(false),
    [title, setTitle] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const parent = trail[trail.length - 1].id;
  const q = useQuery({
    queryKey: ["shared-drive", folder.drf_id, parent, page, ...scope],
    queryFn: async () =>
      (
        await apiClient.get<{ files: DriveFile[]; nextPageToken?: string }>(
          `${base}/${folder.drf_id}`,
          { params: { parent, page } },
        )
      ).data,
  });
  const rows = (q.data?.files ?? [])
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        (sort === "size"
          ? Number(a.size ?? 0) - Number(b.size ?? 0)
          : sort === "type"
            ? a.mimeType.localeCompare(b.mimeType)
            : a.name.localeCompare(b.name)) * (desc ? -1 : 1),
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !w.busy) close();
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{folder.title}</DialogTitle>
        </DialogHeader>
        <nav className="flex flex-wrap gap-2">
          {trail.map((t, i) => (
            <button
              className="underline"
              key={t.id}
              onClick={() => {
                setTrail(trail.slice(0, i + 1));
                setPage(undefined);
              }}
            >
              {i ? " / " : ""}
              {t.name}
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="현재 페이지 파일 검색"
            aria-label="파일 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="정렬"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">이름</option>
            <option value="size">크기</option>
            <option value="type">종류</option>
          </select>
          <Button variant="outline" onClick={() => setDesc(!desc)}>
            {desc ? "내림차순" : "오름차순"}
          </Button>
          <Button variant="outline" onClick={() => setCards(!cards)}>
            {cards ? "목록" : "카드"}
          </Button>
          <Button variant="outline" onClick={() => void q.refetch()}>
            새로고침
          </Button>
        </div>
        {folder.access === "EDIT" && (
          <div className="grid gap-2 rounded border p-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder="새 폴더 이름"
                aria-label="새 폴더 이름"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
              />
              <Button
                disabled={w.busy || !title.trim()}
                onClick={() =>
                  void w.run(async () => {
                    const op = await driveOperation({
                      folder: folder.drf_id,
                      parent,
                      title,
                      kind: "FOLDER",
                    });
                    await apiClient.post(`${base}/${folder.drf_id}/create`, {
                      title,
                      kind: "FOLDER",
                      parentId: parent,
                      operationId: op.id,
                    });
                    op.done();
                    setTitle("");
                    await q.refetch();
                  })
                }
              >
                새 폴더
              </Button>
            </div>
            <label>
              파일 (최대 20MB)
              <input
                className="block max-w-full"
                type="file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>
            <Button
              disabled={w.busy || !file || file.size > 20 * 1024 * 1024}
              onClick={() =>
                void w.run(async () => {
                  if (!file) return;
                  const op = await driveOperation(
                    { folder: folder.drf_id, parent, name: file.name },
                    file,
                  );
                  const data = new FormData();
                  data.append("file", file);
                  data.append("title", file.name);
                  data.append("kind", "DOCUMENT");
                  data.append("parentId", parent);
                  data.append("operationId", op.id);
                  await apiClient.post(`${base}/${folder.drf_id}/upload`, data);
                  op.done();
                  setFile(null);
                  await q.refetch();
                })
              }
            >
              업로드
            </Button>
          </div>
        )}
        {(w.error || q.error) && (
          <p role="alert" className="text-red-600">
            {w.error || errorText(q.error)}
          </p>
        )}
        {q.isLoading ? (
          <p>불러오는 중…</p>
        ) : !rows.length ? (
          <p>표시할 파일이 없습니다.</p>
        ) : (
          <div className={`grid gap-2 ${cards ? "sm:grid-cols-2" : ""}`}>
            {rows.map((f) => (
              <div
                key={f.id}
                className="flex min-w-0 items-center justify-between gap-2 rounded border p-3"
              >
                <div className="min-w-0">
                  <p className="break-words">{f.name}</p>
                  <p className="text-xs">
                    {f.mimeType === "application/vnd.google-apps.folder"
                      ? "폴더"
                      : f.mimeType}{" "}
                    {f.size ? `${Number(f.size).toLocaleString()} bytes` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={w.busy}
                  onClick={() => {
                    if (f.mimeType === "application/vnd.google-apps.folder") {
                      setTrail([...trail, { id: f.id, name: f.name }]);
                      setPage(undefined);
                    } else {
                      const win = window.open("about:blank", "_blank");
                      if (win) win.opener = null;
                      void w.run(async () => {
                        try {
                          const { data } = await apiClient.get<{ url: string }>(
                            `${base}/${folder.drf_id}/open`,
                            { params: { file: f.id } },
                          );
                          if (win) win.location.href = data.url;
                          else location.assign(data.url);
                        } catch (e) {
                          win?.close();
                          throw e;
                        }
                      });
                    }
                  }}
                >
                  열기
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {page && (
            <Button variant="outline" onClick={() => setPage(undefined)}>
              처음
            </Button>
          )}
          {q.data?.nextPageToken && (
            <Button
              variant="outline"
              onClick={() => setPage(q.data?.nextPageToken)}
            >
              다음
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
