---
document_id: FIX-261020B
version: 1.0.0
status: DONE
change_log:
  - 2026-10-20 v1.0.0 — initial
---

# FIX-261020B Shared Drive folder lists are empty (공유폴더 파일 목록 미표시)

## 1. Symptom (증상)
On `/admin/drive`, the connected shared folders (학생별 결과 리포트, ACM - TPI, 공식 맵테스트 문제 유형) show no files, even though the folders contain files in Google Drive.
`GET /api/acm/drive/folders/{id}` returns 200 with an empty list. No backend errors are logged.

## 2. Root Cause (원인)
The Google OAuth connection requested only the `drive.file` scope.
With `drive.file`, Google returns only files that ACM created or opened. Files uploaded directly in Google Drive (web or PC) are left out of `files.list`, so the API returns an empty list without an error.

## 3. Fix (수정)
| Item | Change |
|------|--------|
| OAuth scope | `drive.file` → `https://www.googleapis.com/auth/drive` (`DRIVE_SCOPE`, `drive.client.ts`) |
| Connect callback | If the user unticks Drive on the consent screen, the result is `drive=scope_required` and a message is shown. The connection is not saved. |
| Existing connections | On token refresh, if the granted `scope` lacks full Drive access, the connection is set to `needs_reconnect=true` (409 `DRIVE_RECONNECT_REQUIRED`). The settings screen shows "재연결 필요". No DB migration is needed. |
| Setup guide | `/system/settings/google-oauth`: scope list and consent-screen guide updated (Internal user type recommended; restricted-scope note for External). 4 locales. |

## 4. Operator Action (운영 조치)
1. Google Cloud Console → OAuth consent screen: set the user type to **Internal** (the account that connects must belong to the same Workspace as the Cloud project), and add the `…/auth/drive` scope under Data access.
2. ACM → Google Drive settings → **다시 연결 / 계정 변경**, then sign in with the same account. If it is the same account, the root folder and shared folders are kept.

## 5. Tests (테스트)
- `drive-scope.spec.ts`: scope detection, an old `drive.file` token is flagged for reconnect, and a full-scope token is accepted.
