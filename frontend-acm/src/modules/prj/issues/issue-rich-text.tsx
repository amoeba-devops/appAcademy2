import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { Bold, Code, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react";

/**
 * REQ-261016C — 이슈 설명 리치 텍스트 (AMA IssueFormModal RichTextEditor 자리).
 * 저장은 HTML. 보기는 읽기 전용 Tiptap 으로 그려 스키마 밖 태그·속성은 버린다
 * (dangerouslySetInnerHTML 미사용).
 */
const isHtml = (v: string) => /<\/?[a-z][\s\S]*>/i.test(v);
/** 이전 plain text 본문은 문단으로 감싸 표시·편집한다. */
export function toHtml(v: string) {
  if (!v || isHtml(v)) return v;
  return v
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}
/** 목록 미리보기용 — 문단·줄바꿈은 줄바꿈으로, 나머지 태그는 제거(비활성 문서로 파싱). */
export function plainText(v: string) {
  if (!isHtml(v)) return v;
  const doc = new DOMParser().parseFromString(
    v.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h[1-6]|blockquote)>/gi, "\n"),
    "text/html",
  );
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
/** 빈 문단만 있으면 빈 값. */
export const isBlankHtml = (v: string) => !v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

const prose =
  "doc-prose max-w-none text-sm text-gray-800 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_a]:text-indigo-600 [&_a]:underline";

/** REQ-261016E — 멘션 후보(프로젝트 참여자). */
export interface MentionCandidate {
  id: string;
  name: string;
  email?: string;
}
const MENTION_CLASS = "rounded bg-indigo-50 px-1 font-medium text-indigo-700";
/** 보기·편집 공통 멘션 노드: `<span data-type="mention" data-id data-label>@이름</span>` */
const mentionNode = (suggestion?: MentionOptions["suggestion"]) =>
  Mention.configure({
    HTMLAttributes: { class: MENTION_CLASS },
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
    renderHTML: ({ options, node }) => ["span", options.HTMLAttributes, `@${node.attrs.label ?? node.attrs.id}`],
    ...(suggestion ? { suggestion } : {}),
  });

interface MenuState {
  items: MentionCandidate[];
  index: number;
  left: number;
  top: number;
  command: (c: MentionCandidate) => void;
}

export function IssueRichEditor({
  value,
  onChange,
  placeholder,
  compact = false,
  mentionCandidates,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** REQ-261016D — 댓글용 낮은 높이 */
  compact?: boolean;
  /** REQ-261016E — 있으면 `@` 멘션 사용 */
  mentionCandidates?: MentionCandidate[];
}) {
  const candidates = useRef<MentionCandidate[]>([]);
  candidates.current = mentionCandidates ?? [];
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  menuRef.current = menu;
  const show = (p: SuggestionProps<MentionCandidate>, keep = false) => {
    const rect = p.clientRect?.();
    setMenu((m) => ({
      items: p.items,
      index: keep && m ? Math.min(m.index, Math.max(0, p.items.length - 1)) : 0,
      left: rect?.left ?? 0,
      top: (rect?.bottom ?? 0) + 4,
      command: (c) => p.command({ id: c.id, label: c.name }),
    }));
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      ...(mentionCandidates
        ? [
            mentionNode({
              char: "@",
              items: ({ query }: { query: string }) => {
                const q = query.trim().toLowerCase();
                return candidates.current
                  .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
                  .slice(0, 8);
              },
              render: () => ({
                onStart: (p: SuggestionProps<MentionCandidate>) => show(p),
                onUpdate: (p: SuggestionProps<MentionCandidate>) => show(p, true),
                onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                  const m = menuRef.current;
                  if (!m) return false;
                  if (event.key === "Escape") {
                    setMenu(null);
                    return true;
                  }
                  if (!m.items.length) return false;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    const d = event.key === "ArrowDown" ? 1 : -1;
                    setMenu({ ...m, index: (m.index + d + m.items.length) % m.items.length });
                    return true;
                  }
                  if (event.key === "Enter" || event.key === "Tab") {
                    m.command(m.items[m.index]);
                    return true;
                  }
                  return false;
                },
                onExit: () => setMenu(null),
              }),
            }),
          ]
        : []),
    ],
    content: toHtml(value) || "<p></p>",
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
    editorProps: {
      attributes: {
        class: `${prose} ${compact ? "min-h-[72px] max-h-[240px]" : "min-h-[120px] max-h-[300px]"} overflow-y-auto px-3 py-2 focus:outline-none`,
        "aria-label": placeholder ?? "",
        "data-placeholder": placeholder ?? "",
      },
    },
  });
  // 임시 저장 복원 등 외부 값 교체 — 편집 중 값과 다를 때만 반영
  useEffect(() => {
    if (!editor) return;
    const next = toHtml(value) || "";
    if (next !== (editor.isEmpty ? "" : editor.getHTML())) editor.commands.setContent(next || "<p></p>", { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return null;
  const btn = (active: boolean) =>
    `rounded p-1 ${active ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"}`;
  const tools = [
    { icon: Bold, on: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), label: "Bold" },
    { icon: Italic, on: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), label: "Italic" },
    { icon: Strikethrough, on: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), label: "Strike" },
    { icon: List, on: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), label: "Bullet list" },
    { icon: ListOrdered, on: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), label: "Ordered list" },
    { icon: Quote, on: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote"), label: "Quote" },
    { icon: Code, on: () => editor.chain().focus().toggleCode().run(), active: editor.isActive("code"), label: "Code" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 focus-within:border-indigo-500">
      <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1.5 py-1">
        {tools.map(({ icon: Icon, on, active, label }) => (
          <button key={label} type="button" aria-label={label} aria-pressed={active} onClick={on} className={btn(active)}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
      {menu && (
        <ul
          role="listbox"
          className="fixed z-[200] max-h-56 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
          style={{ left: menu.left, top: menu.top }}
        >
          {menu.items.length ? (
            menu.items.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === menu.index}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => menu.command(c)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${i === menu.index ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {c.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-800">{c.name}</span>
                  {c.email && <span className="truncate text-xs text-gray-400">{c.email}</span>}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-1.5 text-xs text-gray-400">—</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** 설명 보기 — 읽기 전용 Tiptap. */
export function IssueRichView({ html, className = "" }: { html: string; className?: string }) {
  const editor = useEditor(
    {
      editable: false,
      extensions: [StarterKit.configure({ link: { openOnClick: true } }), mentionNode()],
      content: toHtml(html),
      editorProps: { attributes: { class: `${prose} ${className}` } },
    },
    [html],
  );
  return <EditorContent editor={editor} />;
}
