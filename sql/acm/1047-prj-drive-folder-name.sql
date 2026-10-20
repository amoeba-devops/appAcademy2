-- REQ-261018C — 프로젝트 Google Drive 폴더 이름(저장 위치 표시용). 생성 시 저장, 기존 프로젝트는 처음 조회 때 채운다. 멱등.
ALTER TABLE amb_acm_prj_project ADD COLUMN IF NOT EXISTS drive_folder_name VARCHAR(300);
