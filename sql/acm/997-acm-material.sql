-- PLN-260706 Phase 3 — class materials (자료실 / 수업자료).
--
-- A material file belongs to a class (cls_id). Portal visibility is by class
-- membership: students see their enrolled classes' materials, parents see their
-- children's, teachers see the classes they teach. Files live in S3/MinIO;
-- this row holds metadata + the object key.
--
-- @see docs/plan/PLN-260706-acm-portal-accounts-and-role-portals.md §4.5

CREATE TABLE IF NOT EXISTS amb_acm_material (
  mat_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,
  cls_id          UUID         NOT NULL,
  mat_title       VARCHAR(200) NOT NULL,
  mat_s3_key      VARCHAR(300) NOT NULL,
  mat_filename    VARCHAR(255) NOT NULL,
  mat_mime        VARCHAR(120) NOT NULL,
  mat_size_bytes  BIGINT       NOT NULL,
  mat_uploaded_by UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_material_cls
  ON amb_acm_material (ent_id, cls_id)
  WHERE deleted_at IS NULL;
