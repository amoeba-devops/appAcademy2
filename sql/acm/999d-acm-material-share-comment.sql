-- PLN-260718 P3 — 자료실 작성/공유/댓글 (portal teacher/student posts).
--
-- Extends the class-scoped material table so portal teachers and students can
-- author posts and share them per-target:
--   • teacher → students (multi)         : 수업 자료 배포
--   • student → teacher (submission)     : 과제 제출
-- Views are role-scoped (내 게시물 / 공유받은 게시물) and each post has a flat
-- comment thread.
--
-- @see docs/plan/PLN-260718-portal-materials-cal-batch.md §P3

-- 1) amb_acm_material — author kind + make class link optional.
ALTER TABLE amb_acm_material
  ADD COLUMN IF NOT EXISTS mat_author_kind VARCHAR(20);

ALTER TABLE amb_acm_material
  ALTER COLUMN cls_id DROP NOT NULL;

-- 2) share targets (per material).
CREATE TABLE IF NOT EXISTS amb_acm_material_share (
  msh_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id         UUID        NOT NULL,
  mat_id         UUID        NOT NULL,
  msh_tgt_kind   VARCHAR(20) NOT NULL CHECK (msh_tgt_kind IN ('STUDENT','TEACHER')),
  msh_tgt_ref_id UUID        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acm_material_share_mat
  ON amb_acm_material_share (ent_id, mat_id);
CREATE INDEX IF NOT EXISTS idx_acm_material_share_tgt
  ON amb_acm_material_share (ent_id, msh_tgt_kind, msh_tgt_ref_id);

-- 3) flat comment thread (per material).
CREATE TABLE IF NOT EXISTS amb_acm_material_comment (
  mcm_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID        NOT NULL,
  mat_id           UUID        NOT NULL,
  mcm_author_kind  VARCHAR(20) NOT NULL,
  mcm_author_ref_id UUID       NOT NULL,
  mcm_author_name  VARCHAR(100) NOT NULL,
  mcm_body         TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_material_comment_mat
  ON amb_acm_material_comment (ent_id, mat_id)
  WHERE deleted_at IS NULL;
