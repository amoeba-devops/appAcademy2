-- PLN-260719 Phase B — 문서/자료실 게시판 (rich-text doc posts + share roles).
--
-- Extends the materials model so portal users can author rich-text documents
-- (Google-Docs-like) alongside file posts:
--   • amb_acm_material.mat_kind      : 'FILE' (기존) | 'DOC' (리치에디터 문서)
--   • amb_acm_material.mat_content   : DOC 본문 HTML (sanitized at render)
--   • file columns become nullable   : DOC 행은 s3/filename/mime/size 없음
--   • amb_acm_material_share.msh_role: 'VIEWER' | 'EDITOR' (편집자는 본문 수정 가능)
--
-- @see docs/plan/PLN-260719-portal-docs-board-students.md §2

ALTER TABLE amb_acm_material
  ADD COLUMN IF NOT EXISTS mat_kind VARCHAR(10) NOT NULL DEFAULT 'FILE',
  ADD COLUMN IF NOT EXISTS mat_content TEXT;

ALTER TABLE amb_acm_material
  ALTER COLUMN mat_s3_key DROP NOT NULL,
  ALTER COLUMN mat_filename DROP NOT NULL,
  ALTER COLUMN mat_mime DROP NOT NULL,
  ALTER COLUMN mat_size_bytes DROP NOT NULL;

ALTER TABLE amb_acm_material_share
  ADD COLUMN IF NOT EXISTS msh_role VARCHAR(10) NOT NULL DEFAULT 'VIEWER';
