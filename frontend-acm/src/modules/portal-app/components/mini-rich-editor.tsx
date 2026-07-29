import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

/**
 * PLN-260728F B — 피드백/과제 작성용 경량 tiptap 에디터.
 * (문서 게시판 에디터의 축약판 — 굵게/기울임/목록)
 */
const btn =
  'rounded p-1 text-secondary hover:bg-[var(--gray-100)] hover:text-primary';
const active = 'bg-accent-600 text-white hover:bg-accent-600 hover:text-white';

export function MiniRichEditor({
  value,
  onChange,
  minHeight = 120,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '<p></p>',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: 'doc-prose max-w-none rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary focus:outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
  });

  // 외부 value 초기화(다른 이벤트로 전환 등) — 편집 중 덮어쓰기 방지 위해
  // 에디터가 비어있을 때만 반영.
  useEffect(() => {
    if (editor && value && editor.isEmpty) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-1 py-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${btn} ${editor.isActive('bold') ? active : ''}`}
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${btn} ${editor.isActive('italic') ? active : ''}`}
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${btn} ${editor.isActive('bulletList') ? active : ''}`}
        >
          <List size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${btn} ${editor.isActive('orderedList') ? active : ''}`}
        >
          <ListOrdered size={13} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
