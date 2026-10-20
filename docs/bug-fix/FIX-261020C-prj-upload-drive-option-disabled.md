---
document_id: FIX-261020C
version: 1.0.0
status: DONE
change_log:
  - 2026-10-20 v1.0.0 — initial
---

# FIX-261020C Project file upload cannot choose Google Drive (프로젝트 파일 업로드에서 Google Drive 선택 불가)

## 1. Symptom (증상)

`/admin/projects/{id}?tab=documents&type=file` → [파일 업로드]: "회사 Google Drive" 라디오가 비활성이고
"회사 Google Drive가 연결되면 저장 위치를 선택할 수 있습니다." 가 보인다. Drive 는 연결된 상태였다.

## 2. Root Cause (원인, 운영 DB 읽기 전용 확인)

| 사실 | 값 |
| --- | --- |
| Drive 연결 | 연결됨(`tpiglobal.network`, 재연결 필요 아님) |
| 공용폴더(`root_id`) | **비어 있음** |
| 연결 행 생성 시각 | 2026-10-20 13:55 KST — 이 시각에 [연결 해제] 후 다시 연결 |
| 프로젝트 `학원운영` | 같은 계정의 Drive 폴더 보유, Drive 파일 5개(같은 계정) |
| 연결 폴더(`/admin/drive`) | 4개 유지(별도 테이블) |

[연결 해제]는 연결 행을 지우며 공용폴더 지정도 함께 지운다. 같은 계정으로 다시 연결해도 공용폴더는 비어 있다.
업로드 창은 `rootReady`(공용폴더 있음)만 보고 Drive 선택을 막았고, 안내 문구는 "연결되면"이라 실제 상태와 달랐다.

## 3. Fix (수정)

| 항목 | 변경 |
| --- | --- |
| 업로드 가능 판단 | `ProjectDriveService.projectReady` — 공용폴더가 있거나, **이 프로젝트가 같은 계정의 Drive 폴더를 이미 갖고 있으면** 가능. 서버 업로드 검사와 화면(`GET /acm/prj/drive?projectId=`, `projectReady`) 모두 이 기준 |
| 재연결 시 복원 | 같은 계정으로 다시 연결하면 그 계정 프로젝트 폴더의 상위 폴더를 공용폴더로 자동 복원(`restoreRoot`, 실패 시 무시) |
| 안내 문구 | 연결됐지만 공용폴더만 없을 때 "회사 Google Drive 공용폴더가 지정되지 않았습니다." + 관리자는 설정 안내, 그 외는 "관리자에게 공용폴더 지정을 요청하세요." 프로젝트 문서 탭 안내도 같은 기준 |
| 연결 해제 확인 | "공용폴더 지정도 해제되며, 같은 계정으로 다시 연결하면 자동으로 복원됩니다." 추가 |
| 4개 언어 | ko/en/vi/zh-CN |

## 4. Operator Action (운영 조치)

Drive 연동 설정(`/admin/config/drive`)에서 **공용폴더를 다시 지정**한다 — 새 프로젝트의 Drive 폴더 생성에 필요하다.
(이번 수정 배포 후에는 기존 프로젝트 `학원운영` 은 재지정 전에도 Drive 업로드 가능.)

## 5. Tests (테스트)

- `drive-project-ready.spec.ts`: 공용폴더/프로젝트 폴더/다른 계정/재연결 필요/미연결, 상위 폴더 복원·건너뛰기
- `it-prj-drive.int-spec.ts`: 업로드 저장소 선택 테스트를 새 기준(`projectReady`)으로 갱신 — 23/23
- backend unit 115 suites / 872 passed, frontend tsc
