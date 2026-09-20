-- Additive, idempotent. Profiles survive teacher unlinking. No FK to the replaceable link row.
CREATE TABLE IF NOT EXISTS amb_acm_std_teacher_class_info (
  tci_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id uuid NOT NULL,
  std_id uuid NOT NULL REFERENCES amb_acm_std_student(std_id),
  tch_id uuid NOT NULL REFERENCES amb_acm_tch_teacher(tch_id),
  info jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(info) = 'object'),
  legacy_source jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_acm_std_teacher_class_pair UNIQUE(ent_id,std_id,tch_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_std_teacher_class_teacher ON amb_acm_std_teacher_class_info(ent_id,tch_id);
-- Only actual, same-tenant single-teacher links can receive common legacy values.
WITH source AS (
  SELECT s.ent_id,s.std_id,st.tch_id,
    count(*) OVER(PARTITION BY s.ent_id,s.std_id) AS teachers,
    jsonb_build_object('subject',nullif(btrim(s.std_subject),''),
      'curriculum',nullif(btrim(s.std_curriculum),''),'materials',nullif(btrim(s.std_materials),''),
      'mobility',nullif(btrim(s.std_mobility),''),'gpa',nullif(btrim(s.std_gpa),''),
      'ssatIseeNote',nullif(btrim(s.std_ssat_isee_note),'')) AS legacy
  FROM amb_acm_std_student s
  JOIN amb_acm_std_student_teacher st ON st.std_id=s.std_id AND st.ent_id=s.ent_id
  JOIN amb_acm_tch_teacher t ON t.tch_id=st.tch_id AND t.ent_id=s.ent_id
  WHERE s.deleted_at IS NULL
)
INSERT INTO amb_acm_std_teacher_class_info(ent_id,std_id,tch_id,info,legacy_source)
SELECT ent_id,std_id,tch_id,CASE WHEN teachers=1 THEN legacy ELSE '{}'::jsonb END,
  CASE WHEN teachers=1 THEN legacy ELSE NULL END FROM source
ON CONFLICT(ent_id,std_id,tch_id) DO NOTHING;
