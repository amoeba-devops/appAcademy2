-- ============================================================================
-- ACM v1.0g — Dual-write tables: legacy_id BIGINT column (REQ-260622 Phase 0)
--
-- The 14 already-dual-written tables (PG equivalent of a tac_* table exists
-- and is in production use today) don't have a `legacy_id` column yet.
-- Phase 3 migrators need this column to resolve FKs from new PG tables
-- (e.g. amb_acm_pay_order.enrollment_id → amb_acm_csl_enrollment.id) using
-- the same `legacy_id BIGINT UNIQUE` pattern as the new tables.
--
-- This file is **idempotent** — every ALTER uses `ADD COLUMN IF NOT EXISTS`.
-- Safe to re-run.
--
-- Application code is unaffected: nothing reads legacy_id at runtime; it
-- exists only for the duration of the migration. Phase 7 + 30 days drops
-- all of these columns.
--
-- Tables covered (REQ §2.1 dual-write list):
--   1. amb_acm_user                ← tac_users
--   2. amb_acm_std_student         ← tac_students
--   3. amb_acm_std_parent          ← tac_parents
--   4. amb_acm_std_student_parent  ← tac_student_guardians
--   5. amb_acm_tch_teacher         ← tac_teachers
--   6. amb_acm_cls_classes         ← tac_classes
--   7. amb_acm_cls_sessions        ← tac_class_sessions
--   8. amb_acm_cls_attendance      ← tac_attendances
--   9. amb_acm_csl_enrollment      ← tac_enrollments  [CRITICAL — blocks pay]
--  10. amb_acm_csl_inquiry         ← tac_consultations (partial-equiv per Q-5)
--  11. amb_acm_map_passage         ← tac_map_passages
--
-- Not in this file (handled elsewhere):
--   - amb_acm_tenant.legacy_acd_id    — added by sql/acm/950 §0
--   - tac_subscription_events         — sql/acm/980 already has legacy_id
--   - tac_user_academies              — folded into tenant + user.entId,
--                                       no PG row needed
--   - tac_menu_permissions            — schema mismatch with
--                                       amb_acm_tenant_menu; rebuild from
--                                       scratch in Phase 2 backend work
--
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §3.1
-- @see docs/plan/PLN-260622-mysql-to-postgres-full-migration.md Phase 0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reusable: add legacy_id + partial unique index to a table
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'amb_acm_user',
    'amb_acm_std_student',
    'amb_acm_std_parent',
    'amb_acm_std_student_parent',
    'amb_acm_tch_teacher',
    'amb_acm_cls_classes',
    'amb_acm_cls_sessions',
    'amb_acm_cls_attendance',
    'amb_acm_csl_enrollment',
    'amb_acm_csl_inquiry',
    'amb_acm_map_passage'
  ];
  short_name text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Only proceed when the target table exists (avoids order-of-apply
    -- failures if some module hasn't been deployed to this DB yet).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'skip % — table not present', tbl;
      CONTINUE;
    END IF;

    -- 1) Add the column if missing.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = tbl
         AND column_name = 'legacy_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN legacy_id BIGINT', tbl);
      RAISE NOTICE 'added legacy_id on %', tbl;
    END IF;

    -- 2) Partial unique index — only the rows that actually have a
    --    legacy_id need uniqueness. Avoids forcing NOT NULL on existing
    --    rows that pre-date the migration.
    --
    --    Index name caps at 63 chars (PG default). Use a short alias:
    --    drop the 'amb_acm_' prefix.
    short_name := regexp_replace(tbl, '^amb_acm_', '');
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = format('uq_acm_%s_legacy_id', short_name)
    ) THEN
      EXECUTE format(
        'CREATE UNIQUE INDEX uq_acm_%s_legacy_id ON %I (legacy_id) WHERE legacy_id IS NOT NULL',
        short_name, tbl
      );
      RAISE NOTICE 'created uq_acm_%_legacy_id', short_name;
    END IF;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- Smoke (운영자 확인용 — 실행 안 됨)
-- ----------------------------------------------------------------------------
-- SELECT table_name FROM information_schema.columns
--  WHERE table_schema='public' AND column_name='legacy_id'
--  ORDER BY table_name;
--
-- expected: amb_acm_audit_log, amb_acm_classroom, amb_acm_cls_attendance,
-- amb_acm_cls_classes, amb_acm_cls_sessions, amb_acm_csl_enrollment,
-- amb_acm_csl_inquiry, amb_acm_csl_intake_form, amb_acm_csl_visit_record,
-- amb_acm_map_assignment, amb_acm_map_item, amb_acm_map_item_tag,
-- amb_acm_map_passage, amb_acm_map_passage_asset, amb_acm_map_response,
-- amb_acm_map_score, amb_acm_map_test_set, amb_acm_map_test_set_item,
-- amb_acm_notification_log, amb_acm_notification_template,
-- amb_acm_pay_ledger, amb_acm_pay_order, amb_acm_pay_receipt,
-- amb_acm_pay_refund_policy, amb_acm_pay_refund_policy_tier,
-- amb_acm_pay_tax_invoice, amb_acm_post, amb_acm_program,
-- amb_acm_program_setting, amb_acm_std_external_test_score,
-- amb_acm_std_parent, amb_acm_std_student, amb_acm_std_student_parent,
-- amb_acm_subscription_event, amb_acm_tch_teacher, amb_acm_user
