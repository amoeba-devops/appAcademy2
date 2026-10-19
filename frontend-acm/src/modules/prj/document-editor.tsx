import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useBlocker } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Item } from "./types";
import type { WorkbookDocument } from "./workbook-editor";
const WorkbookEditor = lazy(() =>
  import("./workbook-editor").then((m) => ({ default: m.WorkbookEditor })),
);
import { blankSheet, type Sheet } from "./sheet-model";
export type DocumentType = "MEMO" | "SHEET" | "DOC";
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
  const { t: tp } = useTranslation("prj");
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
      "bold",
      () => {
        editor.chain().focus().toggleBold().run();
      },
    ],
    [
      "italic",
      () => {
        editor.chain().focus().toggleItalic().run();
      },
    ],
    [
      "strike",
      () => {
        editor.chain().focus().toggleStrike().run();
      },
    ],
    [
      "heading",
      () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
    ],
    [
      "bulletList",
      () => {
        editor.chain().focus().toggleBulletList().run();
      },
    ],
    [
      "orderedList",
      () => {
        editor.chain().focus().toggleOrderedList().run();
      },
    ],
    [
      "blockquote",
      () => {
        editor.chain().focus().toggleBlockquote().run();
      },
    ],
    [
      "link",
      () => {
        const href = window.prompt(
          tp("richDoc.linkPrompt"),
          (editor.getAttributes("link").href as string) ?? "",
        );
        if (href === null) return;
        if (!href) editor.chain().focus().unsetLink().run();
        else if (/^https?:\/\/\S+$/i.test(href))
          editor.chain().focus().setLink({ href }).run();
      },
    ],
    [
      "undo",
      () => {
        editor.chain().focus().undo().run();
      },
    ],
    [
      "redo",
      () => {
        editor.chain().focus().redo().run();
      },
    ],
  ];
  if (table)
    actions.push(
      [
        "insertTable",
        () => {
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      ],
      [
        "addRow",
        () => {
          editor.chain().focus().addRowAfter().run();
        },
      ],
      [
        "addColumn",
        () => {
          editor.chain().focus().addColumnAfter().run();
        },
      ],
      [
        "deleteRow",
        () => {
          editor.chain().focus().deleteRow().run();
        },
      ],
      [
        "deleteColumn",
        () => {
          editor.chain().focus().deleteColumn().run();
        },
      ],
      [
        "deleteTable",
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
              {tp(`richDoc.${name}`)}
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
  initialMode,
  close,
}: {
  project: string;
  item?: Item;
  type: DocumentType;
  initialMode?: "LOCAL" | "GOOGLE_LINK";
  readOnly: boolean;
  close: () => void;
}) {
  const { t: tp } = useTranslation("prj");
  const qc = useQueryClient();
  const snapshotRef = useRef<(() => WorkbookDocument) | null>(null);
  const [title, setTitle] = useState(item?.pit_title ?? ""),
    [mode, setMode] = useState(
      item?.storage_type === "GOOGLE_LINK" ||
        (!item &&
          (initialMode === "GOOGLE_LINK" || (!initialMode && type === "DOC")))
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
  const dirtyRef = useRef(false),
    leavingRef = useRef(false);
  dirtyRef.current = dirty;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      !leavingRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(tp("documentEditor.confirmDiscard"))) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  const leave = () => {
    leavingRef.current = true;
    close();
  };
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
    if (!busy && (!dirty || window.confirm(tp("documentEditor.confirmDiscard"))))
      leave();
  };
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={tp("documentEditor.backToList")}
          onClick={dismiss}
        >
          ←
        </Button>
        <h1 className="min-w-0 truncate text-lg font-semibold">
          {tp(
            item
              ? readOnly
                ? "documentEditor.headingView"
                : "documentEditor.headingViewEdit"
              : "documentEditor.headingCreate",
            { type: tp(`docType.${type}`) },
          )}
        </h1>
      </div>
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
                throw new Error(tp("documentEditor.tooLarge"));
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
              leave();
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
                  tp("documentEditor.saveFailed"),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {type !== "MEMO" && !item && (
            <div className="flex flex-wrap gap-4">
              {[
                ["LOCAL", tp("documentEditor.modeLocal")],
                [
                  "GOOGLE_LINK",
                  type === "SHEET"
                    ? tp("documentEditor.modeGoogleSheet")
                    : tp("documentEditor.modeGoogleDoc"),
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
            {tp("documentEditor.title")}
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
                {tp("documentEditor.googleAccessNote")}
              </p>
              {item?.external_url &&
                /^https:\/\/docs\.google\.com\/(spreadsheets|document)\/d\/[\w-]+\/edit(?:#gid=\d+)?$/.test(
                  item.external_url,
                ) && (
                  <iframe
                    title={title || tp("documentEditor.googleDocFallbackTitle")}
                    className="h-[75dvh] w-full rounded border"
                    src={item.external_url.replace(/\/edit(?=#|$)/, "/preview")}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                  />
                )}
              <p className="text-xs text-secondary">
                {tp("documentEditor.previewHint")}
              </p>
              {item?.external_url && (
                <a
                  className="underline"
                  href={item.external_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tp("documentEditor.openInGoogle")}
                </a>
              )}
            </>
          ) : type === "SHEET" ? (
            <Suspense fallback={<p>{tp("documentEditor.loadingEditor")}</p>}>
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
              {dirty ? tp("documentEditor.unsaved") : ""}
            </span>
            <Button type="button" variant="outline" onClick={dismiss}>
              {tp("documentEditor.close")}
            </Button>
            {!readOnly && (
              <Button disabled={busy || !title.trim()}>
                {busy ? tp("common.saving") : tp("common.save")}
              </Button>
            )}
          </div>
        </form>
    </div>
  );
}
