---
document_id: TCH-FIX-260831
version: 1.1.0
status: DONE
date: 2026-08-31
change_log:
  - 2026-08-31 v1.0.0 최초 작성 (Claude Code) — tch 모듈
  - 2026-08-31 v1.1.0 frontend-acm 전수 전환 (13개 파일 20건) 추가
---

# FIX-260831 — Native confirm()/alert() → In-app Modal/Toast 전수 전환

## 1. Symptom (증상)

- `/admin/tch` 교사 관리에서 삭제·계정잠금·첨부파일 삭제 시 `window.confirm()`,
  비밀번호 재설정 완료 시 `window.alert()` 네이티브 브라우저 다이얼로그 사용.
- **AMA 포털에서 Custom App `<iframe>` 으로 ACM을 열면 네이티브 다이얼로그가
  표시되지 않아** 확인창 없이 동작이 무시됨 (삭제 불가 현상). 최신 브라우저는
  cross-origin iframe 내 `alert/confirm/prompt` 를 차단한다 (Chrome 92+).

## 2. Root Cause (원인)

tch 모듈만 공용 `useConfirm()`/`useToast()` 로 전환되지 않고 네이티브
다이얼로그를 사용 중이었다. sch/qna/map/system 모듈은 이미
[confirm-dialog.tsx](../../frontend-acm/src/components/ui/confirm-dialog.tsx)
(`ConfirmProvider`, main.tsx 루트 마운트) 기반으로 전환 완료 상태였다.

## 3. Fix (수정 내용)

| File | Before | After |
|------|--------|-------|
| `tch-form-modal.tsx` onDelete | `confirm(t('confirm.delete'))` | `useConfirm()` 모달 — title `tch:confirm.delete`, description `common:confirm.deleteDescription`, `variant: 'destructive'` |
| `tch-form-modal.tsx` 계정잠금 | `confirm(t('confirm.lock'))` | `useConfirm()` 모달 — title `tch:actions.lock`, description `tch:confirm.lock` |
| `tch-form-modal.tsx` 비밀번호 재설정 | `alert(t('toast.passwordReset'))` | `useToast().success()` |
| `tch-attachment-panel.tsx` 첨부 삭제 | `confirm(t('attachment.confirm.delete'))` | `useConfirm()` 모달 |

- i18n: 기존 키 재사용 (ko/en/vi/zh-CN 4개 로케일 모두 존재 확인) — 신규 키 없음.
- 모달 z-index: ConfirmProvider Dialog 는 Radix Portal 로 body 말단에 append —
  TchFormModal(Dialog) 위에 정상 표시.

## 4. Full Sweep (전수 전환 — v1.1.0)

tch 외 전 모듈의 네이티브 다이얼로그를 동일 패턴으로 전환했다.
`confirm()` → `useConfirm()` 모달 (삭제·해제·강제폐쇄는 `variant: 'destructive'`),
`alert()` → `useToast().success()/error()`.

| Module | File | 전환 내용 |
|--------|------|-----------|
| portal-app | `portal-materials-page.tsx` | 게시물 삭제 confirm |
| portal-app | `portal-doc-page.tsx` | 첨부 업로드 실패 alert→toast.error, 문서 삭제 confirm, 버전 복원 confirm |
| posts | `post-editor-page.tsx` | 게시물 삭제 confirm |
| std | `std-detail-page.tsx` | 학생 비활성 confirm, 학부모 연결해제 confirm |
| std | `parent-list-page.tsx` | 학부모 삭제 confirm |
| cal | `cal-event-attachment-panel.tsx` | 다운로드 실패 alert→toast.error, 첨부 삭제 confirm |
| cal | `cal-event-modal.tsx` | BODA 룸 강제폐쇄 confirm |
| csl | `attachment-panel.tsx` | 다운로드/미리보기 실패 alert→toast.error ×2, 첨부 삭제 confirm |
| csl | `level-test-panel.tsx` | PDF 다운로드/미리보기 실패 alert→toast.error ×2 |
| notifications | `notifications-list-page.tsx` | 재발송 완료 alert→toast.success |
| stf | `stf-form-modal.tsx` | 비밀번호 재설정 alert→toast.success, 직원 삭제 confirm |
| talk | `talk-chat.tsx` | 메시지 삭제 confirm |

- alert 에러 메시지의 영문 하드코딩 fallback('Download failed' 등)은
  `t('common:status.error')` i18n 키로 대체 (4 locale 기존 키 재사용).

## 5. Verification (검증)

- `npx tsc --noEmit` 통과.
- frontend-acm/src 전체 `window.confirm/alert/prompt` + bare `confirm(`/`alert(`
  네이티브 호출 잔존 **0건** (grep 확인, confirm-dialog.tsx 자체 제외).
- 사용 i18n 키(stf/tch confirm.delete, toast.passwordReset, common status.error,
  confirm.deleteDescription) 4개 로케일(ko/en/vi/zh-CN) 존재 확인.
