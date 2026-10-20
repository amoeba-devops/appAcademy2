import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  Baseline,
  Bold,
  ChevronLeft,
  Code,
  FileText,
  Folder,
  HardDrive,
  Heading2,
  Highlighter,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Paperclip,
  Redo,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo,
  Upload,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DriveStatus } from "./types";

/**
 * PLN-261020C — 문서 편집기(AMA 회의록 편집기와 같은 아이콘 툴바).
 * 저장은 tiptap JSON. 이미지·첨부는 ACM 저장소에 올리고 고유 링크만 넣는다(base64 금지).
 * `full`(DOC) 일 때만 이미지·첨부·Drive·표·HTML 소스를 쓴다.
 */
const TEXT_COLORS = ["#111827", "#6b7280", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed"];
const HIGHLIGHTS = ["#fef08a", "#fed7aa", "#fecaca", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e5e7eb"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const FOLDER = "application/vnd.google-apps.folder";
type Menu = "color" | "highlight" | "image" | "table";
interface Asset {
  url: string;
  name: string;
  size: number;
}
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  webViewLink?: string | null;
}

const fileSize = (b: number) =>
  b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${Math.round(b / 1024)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`;

export function RichDocument({
  initial,
  onChange,
  readOnly,
  full,
  project,
}: {
  initial: JSONContent;
  onChange: (v: JSONContent) => void;
  readOnly: boolean;
  /** DOC — 이미지·첨부·Drive·표·HTML 소스 사용 */
  full: boolean;
  project: string;
}) {
  const { t: tp } = useTranslation("prj");
  const [menu, setMenu] = useState<{ name: Menu; left: number; top: number } | null>(null);
  const [busy, setBusy] = useState<"image" | "file" | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [drivePicker, setDrivePicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<(files: File[]) => void>(() => undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: readOnly, protocols: ["https", "http"] },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: tp("richDoc.placeholder") }),
      ...(full
        ? [
            TableKit.configure({ table: { resizable: true } }),
            Image.configure({ allowBase64: false, HTMLAttributes: { class: "max-w-full rounded" } }),
          ]
        : []),
    ],
    content: initial,
    editable: !readOnly,
    // 툴바 활성 표시를 커서 이동에 맞춰 갱신한다(v3 기본값은 false).
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: { class: "doc-prose min-h-64 max-w-none p-4 outline-none" },
      handleDrop: (_view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!full || moved || !files.length) return false;
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => IMAGE_TYPES.includes(f.type));
        if (!full || !files.length) return false;
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
    },
  });
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-rich-menu]")) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const upload = async (file: File, kind: "image" | "file"): Promise<Asset> => {
    const form = new FormData();
    form.append("file", file);
    return (
      await apiClient.post<Asset>(`/acm/prj/projects/${project}/doc-assets?kind=${kind}`, form, {
        timeout: 90000,
      })
    ).data;
  };
  const insertImages = async (files: File[]) => {
    if (!editor) return;
    setError("");
    setBusy("image");
    try {
      for (const f of files) {
        const a = await upload(f, "image");
        editor.chain().focus().setImage({ src: a.url, alt: a.name }).run();
      }
    } catch {
      setError(tp("richDoc.uploadFailed"));
    } finally {
      setBusy(null);
    }
  };
  const insertLink = (e: Editor, href: string, label: string) =>
    e
      .chain()
      .focus()
      .insertContent([
        { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] },
        { type: "text", text: " " },
      ])
      .run();
  const attachFiles = async (files: File[]) => {
    if (!editor) return;
    setError("");
    setBusy("file");
    try {
      for (const f of files) {
        const a = await upload(f, "file");
        insertLink(editor, a.url, `📎 ${a.name} (${fileSize(a.size)})`);
      }
    } catch {
      setError(tp("richDoc.uploadFailed"));
    } finally {
      setBusy(null);
    }
  };
  uploadRef.current = (files) => {
    const images = files.filter((f) => IMAGE_TYPES.includes(f.type));
    const others = files.filter((f) => !IMAGE_TYPES.includes(f.type));
    void (async () => {
      if (images.length) await insertImages(images);
      if (others.length) await attachFiles(others);
    })();
  };

  const drive = useQuery({
    queryKey: ["prj", "drive-status"],
    queryFn: async () => (await apiClient.get<DriveStatus>("/acm/prj/drive")).data,
    enabled: full && !readOnly,
    staleTime: 60_000,
  });

  if (!editor) return null;
  const openMenu = (name: Menu) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu?.name === name) return setMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ name, left: Math.min(r.left, window.innerWidth - 224), top: r.bottom + 4 });
  };
  const run = (fn: () => void) => () => {
    fn();
    setMenu(null);
  };
  const addLink = () => {
    const href = window.prompt(tp("richDoc.linkPrompt"), (editor.getAttributes("link").href as string) ?? "");
    if (href === null) return;
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (/^https?:\/\/\S+$/i.test(href)) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };
  const imageUrl = () => {
    setMenu(null);
    const src = window.prompt(tp("richDoc.imageUrlPrompt"), "https://");
    if (src && /^https:\/\/\S+$/i.test(src)) editor.chain().focus().setImage({ src }).run();
  };
  const toggleSource = () => {
    setMenu(null);
    if (source === null) return setSource(editor.getHTML());
    editor.commands.setContent(source);
    onChange(editor.getJSON());
    setSource(null);
  };
  const off = source !== null;
  const tool = (
    label: string,
    icon: ReactNode,
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void,
    active = false,
    disabled = off,
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        setMenu(null);
        onClick(e);
      }}
      className={clsx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded sm:h-8 sm:w-8 disabled:opacity-40",
        active ? "bg-accent-50 text-accent-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
      )}
    >
      {icon}
    </button>
  );
  const bar = <span className="mx-1 h-5 w-px shrink-0 bg-gray-200" aria-hidden />;
  const icon = "h-4 w-4";
  const textColor = editor.getAttributes("textStyle").color as string | undefined;
  const markColor = editor.getAttributes("highlight").color as string | undefined;

  return (
    <div
      onDragOver={(e) => {
        if (full && !readOnly && e.dataTransfer.types.includes("Files")) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={() => setDragOver(false)}
      className={clsx(
        "relative min-w-0 rounded-lg border bg-white",
        dragOver
          ? "border-accent-500 ring-2 ring-accent-100"
          : !readOnly && "focus-within:border-accent-500 focus-within:ring-1 focus-within:ring-accent-500",
      )}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-accent-50/80 text-accent-700">
          <Upload className="mr-2 h-5 w-5" />
          <span className="text-sm font-medium">{tp("richDoc.dropHere")}</span>
        </div>
      )}
      {!readOnly && (
        <div
          data-rich-menu
          role="toolbar"
          aria-label={tp("richDoc.toolbar")}
          className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto rounded-t-lg border-b bg-white px-2 py-1 sm:flex-wrap sm:overflow-visible"
        >
          {tool(tp("richDoc.bold"), <Bold className={icon} />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
          {tool(tp("richDoc.italic"), <Italic className={icon} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
          {tool(tp("richDoc.underline"), <UnderlineIcon className={icon} />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
          {bar}
          {tool(
            tp("richDoc.textColor"),
            <span className="flex flex-col items-center">
              <Baseline className={icon} />
              <span className="-mt-0.5 h-1 w-4 rounded" style={{ background: textColor ?? "#111827" }} />
            </span>,
            openMenu("color"),
            menu?.name === "color",
          )}
          {tool(
            tp("richDoc.highlight"),
            <span className="flex flex-col items-center">
              <Highlighter className={icon} />
              <span className="-mt-0.5 h-1 w-4 rounded border" style={{ background: markColor ?? "transparent" }} />
            </span>,
            openMenu("highlight"),
            menu?.name === "highlight" || editor.isActive("highlight"),
          )}
          {bar}
          {tool(tp("richDoc.heading"), <Heading2 className={icon} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
          {bar}
          {tool(tp("richDoc.bulletList"), <List className={icon} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
          {tool(tp("richDoc.orderedList"), <ListOrdered className={icon} />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
          {tool(tp("richDoc.taskList"), <ListChecks className={icon} />, () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"))}
          {bar}
          {full &&
            tool(
              tp("richDoc.image"),
              busy === "image" ? <Loader2 className={clsx(icon, "animate-spin")} /> : <ImageIcon className={icon} />,
              openMenu("image"),
              menu?.name === "image",
              off || !!busy,
            )}
          {full &&
            tool(
              tp("richDoc.attach"),
              busy === "file" ? <Loader2 className={clsx(icon, "animate-spin")} /> : <Paperclip className={icon} />,
              () => fileInput.current?.click(),
              false,
              off || !!busy,
            )}
          {full &&
            drive.data?.rootReady &&
            tool(tp("richDoc.drive"), <HardDrive className={icon} />, () => setDrivePicker(true))}
          {tool(tp("richDoc.link"), <LinkIcon className={icon} />, addLink, editor.isActive("link"))}
          {full && (
            <>
              {bar}
              {tool(tp("richDoc.table"), <TableIcon className={icon} />, openMenu("table"), menu?.name === "table" || editor.isActive("table"))}
            </>
          )}
          {bar}
          {tool(tp("richDoc.undo"), <Undo className={icon} />, () => editor.chain().focus().undo().run(), false, off || !editor.can().undo())}
          {tool(tp("richDoc.redo"), <Redo className={icon} />, () => editor.chain().focus().redo().run(), false, off || !editor.can().redo())}
          {full && (
            <>
              {bar}
              {tool(tp("richDoc.source"), <Code className={icon} />, toggleSource, off, false)}
            </>
          )}
        </div>
      )}
      {menu && (
        <div
          data-rich-menu
          className="fixed z-50 w-56 rounded-lg border bg-white p-2 shadow-lg"
          style={{ left: Math.max(8, menu.left), top: menu.top }}
        >
          {(menu.name === "color" || menu.name === "highlight") && (
            <>
              <div className="grid grid-cols-8 gap-1">
                {(menu.name === "color" ? TEXT_COLORS : HIGHLIGHTS).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    title={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={run(() =>
                      menu.name === "color"
                        ? editor.chain().focus().setColor(c).run()
                        : editor.chain().focus().setHighlight({ color: c }).run(),
                    )}
                    className="h-6 w-6 rounded border border-gray-200"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={run(() =>
                  menu.name === "color"
                    ? editor.chain().focus().unsetColor().run()
                    : editor.chain().focus().unsetHighlight().run(),
                )}
                className="mt-2 w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {tp("richDoc.clearColor")}
              </button>
            </>
          )}
          {menu.name === "image" && (
            <>
              <MenuItem icon={<Upload className={icon} />} onClick={run(() => imageInput.current?.click())}>
                {tp("richDoc.imageUpload")}
              </MenuItem>
              <MenuItem icon={<LinkIcon className={icon} />} onClick={imageUrl}>
                {tp("richDoc.imageUrl")}
              </MenuItem>
            </>
          )}
          {menu.name === "table" &&
            (
              [
                ["insertTable", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()],
                ["addRow", () => editor.chain().focus().addRowAfter().run()],
                ["addColumn", () => editor.chain().focus().addColumnAfter().run()],
                ["deleteRow", () => editor.chain().focus().deleteRow().run()],
                ["deleteColumn", () => editor.chain().focus().deleteColumn().run()],
                ["deleteTable", () => editor.chain().focus().deleteTable().run()],
              ] as [string, () => void][]
            ).map(([name, fn]) => (
              <MenuItem key={name} onClick={run(fn)} disabled={name !== "insertTable" && !editor.isActive("table")}>
                {tp(`richDoc.${name}`)}
              </MenuItem>
            ))}
        </div>
      )}
      <input
        ref={imageInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void insertImages(files);
        }}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void attachFiles(files);
        }}
      />
      {error && (
        <p role="alert" className="border-b bg-red-50 px-3 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {source !== null ? (
        <div className="p-2">
          <p className="mb-1 text-xs text-secondary">{tp("richDoc.sourceHint")}</p>
          <textarea
            aria-label={tp("richDoc.source")}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="min-h-64 w-full rounded border p-2 font-mono text-xs"
          />
        </div>
      ) : (
        <div className="max-w-full overflow-auto [&_td]:border [&_th]:border [&_td]:p-2 [&_th]:p-2">
          <EditorContent editor={editor} />
        </div>
      )}
      {drivePicker && (
        <DrivePicker
          project={project}
          onClose={() => setDrivePicker(false)}
          onPick={(f) => {
            setDrivePicker(false);
            insertLink(
              editor,
              f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
              `📎 ${f.name}${f.size ? ` (${fileSize(Number(f.size))})` : ""}`,
            );
          }}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {icon}
      {children}
    </button>
  );
}

/** 프로젝트 Google Drive 폴더에서 파일을 골라 링크로 넣는다. */
function DrivePicker({
  project,
  onClose,
  onPick,
}: {
  project: string;
  onClose: () => void;
  onPick: (f: DriveFile) => void;
}) {
  const { t: tp } = useTranslation("prj");
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const parent = path.at(-1)?.id;
  const q = useQuery({
    queryKey: ["prj", "doc-drive", project, parent ?? ""],
    queryFn: async () =>
      (
        await apiClient.get<{ files: DriveFile[] }>(`/acm/prj/projects/${project}/drive`, {
          params: parent ? { parent } : {},
        })
      ).data,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tp("richDoc.drivePicker.title")}</DialogTitle>
        </DialogHeader>
        {path.length > 0 && (
          <button
            type="button"
            onClick={() => setPath((p) => p.slice(0, -1))}
            className="flex items-center gap-1 text-sm text-accent-700 hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {tp("richDoc.drivePicker.up")}
          </button>
        )}
        <div className="max-h-80 overflow-y-auto rounded border">
          {q.isLoading ? (
            <p className="p-4 text-sm text-secondary">{tp("richDoc.drivePicker.loading")}</p>
          ) : q.isError ? (
            <p className="p-4 text-sm text-red-700">{tp("richDoc.drivePicker.failed")}</p>
          ) : !q.data?.files.length ? (
            <p className="p-4 text-sm text-secondary">{tp("richDoc.drivePicker.empty")}</p>
          ) : (
            <ul className="divide-y">
              {q.data.files.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() =>
                      f.mimeType === FOLDER ? setPath((p) => [...p, { id: f.id, name: f.name }]) : onPick(f)
                    }
                    className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {f.mimeType === FOLDER ? (
                      <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    )}
                    <span className="truncate">{f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
