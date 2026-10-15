import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Item } from "./types";
import type { WorkbookDocument } from "./workbook-editor";
const WorkbookEditor = lazy(() =>
  import("./workbook-editor").then((m) => ({ default: m.WorkbookEditor })),
);
import { blankSheet, type Sheet } from "./sheet-model";
const names = { MEMO: "메모", SHEET: "시트(스프레드시트)", DOC: "문서(Docs)" };
export type DocumentType = keyof typeof names;
export function RichDocument({
  initial,
  onChange,
  readOnly,
  table,
}: {
  initial: JSONContent;
  onChange: (v: JSONContent) => void;
  readOnly: boolean;
  table: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ["https", "http"] },
      }),
      ...(table ? [TableKit.configure({ table: { resizable: true } })] : []),
    ],
    content: initial,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: { class: "doc-prose min-h-64 max-w-none p-4 outline-none" },
    },
  });
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  if (!editor) return null;
  const actions: [string, () => void][] = [
    [
      "굵게",
      () => {
        editor.chain().focus().toggleBold().run();
      },
    ],
    [
      "기울임",
      () => {
        editor.chain().focus().toggleItalic().run();
      },
    ],
    [
      "취소선",
      () => {
        editor.chain().focus().toggleStrike().run();
      },
    ],
    [
      "제목",
      () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
    ],
    [
      "목록",
      () => {
        editor.chain().focus().toggleBulletList().run();
      },
    ],
    [
      "번호 목록",
      () => {
        editor.chain().focus().toggleOrderedList().run();
      },
    ],
    [
      "인용",
      () => {
        editor.chain().focus().toggleBlockquote().run();
      },
    ],
    [
      "링크",
      () => {
        const href = window.prompt(
          "https:// 링크 주소 (빈 값은 해제)",
          (editor.getAttributes("link").href as string) ?? "",
        );
        if (href === null) return;
        if (!href) editor.chain().focus().unsetLink().run();
        else if (/^https?:\/\/\S+$/i.test(href))
          editor.chain().focus().setLink({ href }).run();
      },
    ],
    [
      "되돌리기",
      () => {
        editor.chain().focus().undo().run();
      },
    ],
    [
      "다시 실행",
      () => {
        editor.chain().focus().redo().run();
      },
    ],
  ];
  if (table)
    actions.push(
      [
        "표 삽입",
        () => {
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      ],
      [
        "행 추가",
        () => {
          editor.chain().focus().addRowAfter().run();
        },
      ],
      [
        "열 추가",
        () => {
          editor.chain().focus().addColumnAfter().run();
        },
      ],
      [
        "행 삭제",
        () => {
          editor.chain().focus().deleteRow().run();
        },
      ],
      [
        "열 삭제",
        () => {
          editor.chain().focus().deleteColumn().run();
        },
      ],
      [
        "표 삭제",
        () => {
          editor.chain().focus().deleteTable().run();
        },
      ],
    );
  return (
    <div className="min-w-0 rounded border">
      {!readOnly && (
        <div className="flex flex-wrap gap-1 border-b p-2">
          {actions.map(([name, fn]) => (
            <Button key={name} type="button" variant="outline" onClick={fn}>
              {name}
            </Button>
          ))}
        </div>
      )}
      <div className="max-w-full overflow-auto [&_td]:border [&_th]:border [&_td]:p-2 [&_th]:p-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
export function DocumentEditor({
  project,
  item,
  type,
  readOnly,
  close,
}: {
  project: string;
  item?: Item;
  type: DocumentType;
  readOnly: boolean;
  close: () => void;
}) {
  const qc = useQueryClient();
  const snapshotRef = useRef<(() => WorkbookDocument) | null>(null);
  const [title, setTitle] = useState(item?.pit_title ?? ""),
    [mode, setMode] = useState(
      item?.storage_type === "GOOGLE_LINK" || (!item && type === "DOC")
        ? "GOOGLE_LINK"
        : "LOCAL",
    ),
    [url, setUrl] = useState(item?.external_url ?? ""),
    [content, setContent] = useState<JSONContent | Sheet | WorkbookDocument>(
      (item?.content as JSONContent | Sheet | WorkbookDocument) ??
        (type === "SHEET"
          ? blankSheet()
          : {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  ...(item?.pit_body
                    ? { content: [{ type: "text", text: item.pit_body }] }
                    : {}),
                },
              ],
            }),
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const dismiss = () => {
    if (!busy && (!dirty || window.confirm("저장하지 않은 변경을 버릴까요?")))
      close();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl max-h-[94dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {names[type]} {item ? "보기 / 수정" : "작성"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-3"
          onInputCapture={() => {
            if (!readOnly) setDirty(true);
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const savedContent =
                type === "SHEET" && mode === "LOCAL" && snapshotRef.current
                  ? snapshotRef.current()
                  : content;
              if (
                mode === "LOCAL" &&
                new TextEncoder().encode(JSON.stringify(savedContent)).length >
                  60000
              )
                throw new Error("문서 크기는 60KB 이하로 작성하세요.");
              const data = {
                title,
                documentType: type,
                storageType: mode,
                content: mode === "LOCAL" ? savedContent : undefined,
                url: mode === "GOOGLE_LINK" ? url : undefined,
                revision: item?.revision,
              };
              const path = `/acm/prj/projects/${project}/documents`;
              if (item) await apiClient.put(`${path}/${item.pit_id}`, data);
              else await apiClient.post(path, data);
              setDirty(false);
              await qc.invalidateQueries({ queryKey: ["prj"] });
              close();
            } catch (e) {
              const x = e as {
                message?: string;
                response?: {
                  data?: { message?: string; error?: { message?: string } };
                };
              };
              setError(
                x.response?.data?.error?.message ??
                  x.response?.data?.message ??
                  x.message ??
                  "저장하지 못했습니다. 내용을 보존하고 다시 시도하세요.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {type !== "MEMO" && !item && (
            <div className="flex flex-wrap gap-4">
              {[
                ["LOCAL", "직접 작성"],
                [
                  "GOOGLE_LINK",
                  type === "SHEET"
                    ? "구글시트 연동(링크)"
                    : "구글독스 연동(링크)",
                ],
              ].map(([v, label]) => (
                <label key={v}>
                  <input
                    type="radio"
                    checked={mode === v}
                    onChange={() => {
                      setMode(v);
                      setDirty(true);
                    }}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          )}
          <label>
            제목
            <Input
              required
              maxLength={200}
              value={title}
              readOnly={readOnly}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          {mode === "GOOGLE_LINK" ? (
            <>
              <label>
                Google {type === "SHEET" ? "Sheets" : "Docs"} URL
                <Input
                  required
                  type="url"
                  value={url}
                  readOnly={readOnly}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <p className="text-sm">
                Google 원본 접근 권한이 필요합니다. 링크 등록은 문서 내용을
                복사하거나 공유 권한을 변경하지 않습니다.
              </p>
              {item?.external_url &&
                /^https:\/\/docs\.google\.com\/(spreadsheets|document)\/d\/[\w-]+\/edit$/.test(
                  item.external_url,
                ) && (
                  <iframe
                    title={title || "Google 문서"}
                    className="h-[60dvh] w-full rounded border"
                    src={item.external_url.replace(/\/edit$/, "/preview")}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                  />
                )}
              <p className="text-xs text-secondary">
                미리보기가 표시되지 않으면 Google 계정의 접근 권한을 확인하고 새
                탭에서 열어 주세요.
              </p>
              {item?.external_url && (
                <a
                  className="underline"
                  href={item.external_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google에서 열기
                </a>
              )}
            </>
          ) : type === "SHEET" ? (
            <Suspense fallback={<p>편집기 불러오는 중…</p>}>
              <WorkbookEditor
                project={project}
                snapshotRef={snapshotRef}
                title={title}
                value={content as Sheet | WorkbookDocument}
                readOnly={readOnly || busy}
                onChange={(v) => {
                  setContent(v);
                  setDirty(true);
                }}
              />
            </Suspense>
          ) : (
            <RichDocument
              initial={content as JSONContent}
              table={type === "DOC"}
              readOnly={readOnly || busy}
              onChange={(v) => {
                setContent(v);
                setDirty(true);
              }}
            />
          )}
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <div className="sticky bottom-0 flex justify-end gap-2 bg-surface py-2">
            <span className="mr-auto text-sm">
              {dirty ? "저장하지 않은 변경" : ""}
            </span>
            <Button type="button" variant="outline" onClick={dismiss}>
              닫기
            </Button>
            {!readOnly && (
              <Button disabled={busy || !title.trim()}>
                {busy ? "저장 중…" : "저장"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
