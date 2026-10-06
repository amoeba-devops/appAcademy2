-- Apply only during the authorized configuration-permission rollout, after migration 999x.
-- Idempotent; never changes the user's existing role or AMA attributes.
BEGIN;
DO $$
DECLARE matched INTEGER;
BEGIN
  SELECT COUNT(*) INTO matched FROM amb_acm_user WHERE lower(usr_email)='fremd@naver.com';
  IF matched <> 1 THEN RAISE EXCEPTION 'Expected exactly one target account, found %', matched; END IF;
  PERFORM 1 FROM amb_acm_user
    WHERE usr_id='465380c8-0b7f-4ef6-81bd-5aa732fdc8df'
      AND ent_id='00000000-0000-0000-0000-000000000001'
      AND lower(usr_email)='fremd@naver.com' AND usr_status='ACTIVE' AND usr_role='ADMIN'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target account identity/status changed'; END IF;
  INSERT INTO amb_acm_user_permission(ent_id,usr_id,upr_permission)
    VALUES ('00000000-0000-0000-0000-000000000001','465380c8-0b7f-4ef6-81bd-5aa732fdc8df','CONFIG_ADMIN')
    ON CONFLICT (ent_id,usr_id,upr_permission) DO NOTHING;
END $$;
COMMIT;
