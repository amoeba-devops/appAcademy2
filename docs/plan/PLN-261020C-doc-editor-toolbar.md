---
document_id: PLN-261020C
version: 1.0.0
status: PROPOSED
change_log:
  - 2026-10-20 v1.0.0 — initial (REQ + plan)
---

# PLN-261020C Document editor toolbar (문서 작성 편집기 개선)

## 1. Requirement (요구사항)
Screen: `/admin/projects/{id}/documents/new?type=doc&mode=LOCAL` ("ACM에서 작성").
Improve the editor to match the reference image (AMA meeting-notes `RichTextEditor`): an icon toolbar with groups and a placeholder.

## 2. Current vs Target (현재 · 목표)
| | Current | Target |
|---|---|---|
| Toolbar | 16 outlined **text buttons** (굵게, 기울임, 취소선, 제목 … 표 삭제), wraps to 2–3 lines | **Icon buttons** (lucide) in groups with dividers, tooltip = name, active state highlighted |
| Formatting | bold, italic, strike, H2, lists, quote, link | + **underline, text color, highlight, checklist** |
| Media | none | **image** (upload / URL), **file attach**, **Google Drive file link** |
| Other | — | **HTML source view** (`<>`), placeholder "내용을 입력하세요…" |
| Table (DOC) | 6 text buttons | one **table icon** with a dropdown (insert · add row/col · delete row/col · delete table) |
| Frame | square border | rounded border, sticky toolbar, focus ring, drag-and-drop/paste image upload |

## 3. Mockup (화면 구성안)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ B  I  U │ A̲  🖍 │ H2 │ •≡  1≡  ☑≡ │ 🖼  📎  🗄  🔗 │ ⊞▾ │ ↶  ↷ │ <>        │  ← sticky
├──────────────────────────────────────────────────────────────────────────┤
│ 내용을 입력하세요…                                                        │
│                                                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
 A̲ 🖍 : color palette popover (8 colors + clear)
 🖼   : menu [파일 업로드 | URL 입력]          ⊞▾ : table menu (DOC only)
 🗄   : shown only when the project has a Google Drive folder → file picker
 Mobile: toolbar scrolls horizontally in one row (36px touch targets)
```

## 4. Design (설계)
### 4.1 Frontend (`frontend-acm/src/modules/prj/`)
- `RichDocument` in `document-editor.tsx` → new `rich-document.tsx` (icon toolbar, popovers).
- Add tiptap 3.28 packages: `extension-text-style` (Color), `extension-highlight`, `extension-list` (TaskList/TaskItem), `extension-image`, `extensions` (Placeholder). Underline is already in StarterKit 3.
- Content stays **tiptap JSON** (60KB limit unchanged). Images are never stored as base64.
- HTML source view: edit `editor.getHTML()` in a textarea, then apply with `setContent` (tiptap drops tags and attributes outside the schema, and `dangerouslySetInnerHTML` is not used).
- Read-only view (same component) renders the new nodes (checkbox disabled).
- i18n: new `richDoc.*` keys in 4 locales (tooltips, menus, placeholder).

### 4.2 Backend — inline assets (`acm-prj`)
`<img>` cannot send the Bearer header, so assets use an unguessable link:
- `POST /api/acm/prj/projects/:id/doc-assets` (project member, multipart, image ≤ 10MB / file ≤ 50MB) → stores in ACM storage (MinIO) and returns `{ url: '/api/acm/prj/doc-assets/{assetId}/{token}' }`.
- `GET /api/acm/prj/doc-assets/:assetId/:token` (no login) → server stream. Token = HMAC(asset id), constant-time compare. Images `inline`; other files `attachment`. `Cache-Control: private, max-age=86400`.
- Table `amb_acm_prj_doc_asset` (migration 1048): `pda_id`, `ent_id`, `prj_id`, `object_key`, `file_name`, `mime_type`, `size_bytes`, `created_by`, `created_at`, `deleted_at`.
- Images allowed: png, jpeg, gif, webp (SVG is refused).
- Drive button: reuses `GET /projects/:id/drive` (project folder browse) and inserts the file's Drive link. No new API.

### 4.3 Out of scope (범위 밖)
Mentions, wiki links `[[ ]]`, memo (MEMO type) editor, issue editor, portal editor.

## 5. Tasks (작업)
1. Migration 1048 + doc-asset service/controller + unit/integration test.
2. `rich-document.tsx` icon toolbar + color/table/image menus + upload (button, drop, paste) + Drive picker + source view.
3. i18n 4 locales, mobile check (16px, 36px targets), build/lint.
4. Local Playwright check (desktop + mobile), PR → CI → deploy.

## 6. Risks (위험)
- Anyone holding an asset link can open the file (like a Google "anyone with link" share). The link has 128-bit randomness and is visible only inside the document.
- Existing documents keep working: same JSON format, only new node types are added.
