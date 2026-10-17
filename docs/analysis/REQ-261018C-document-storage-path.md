---
document_id: ACM-DOC-STORAGE-PATH-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-18
change_log:
  - version: 1.0.0
    date: 2026-10-18
    description: Show where uploaded files are stored; align upload limit / 업로드 저장 위치 표시·용량 한도 통일
---
# Document File Storage Path Display (문서 파일 저장 위치 표시)

요청: "문서 - 파일에서 업로드한 파일의 저장 경로와 드라이브에서 업로드한 파일의 저장 경로가 다름" → 확인 결과 설계상 다른 위치이며, 사용자가 **1안(구조 유지 + 저장 위치 표시)** 선택.

## 1. Current (현황)

| 화면 | 저장 위치 | 한도 |
| --- | --- | --- |
| 문서 › 파일 / 프로젝트 › 자료 업로드 | Google Drive `공용폴더(TPI-New) › {프로젝트명} ({ID 8자리})` 또는 ACM 저장소(MinIO) | 20MB |
| 드라이브 `/admin/drive` | 연결된 공유 폴더(TPI, TPI-New) 중 지금 보고 있는 폴더 | 50MB |

## 2. Requirements (요구사항)

| ID | 요구사항 |
| --- | --- |
| FR-1 | 업로드 창의 저장 위치 옵션에 실제 경로 표시: "Google Drive › TPI-New › 학원운영" / "ACM 저장소(Google Drive 에 보이지 않음)" |
| FR-2 | 문서 › 파일 목록에 **저장 위치** 열 추가(Drive 경로 또는 ACM 저장소). Drive 파일은 경로를 누르면 Google Drive 폴더 열림 |
| FR-3 | 드라이브 화면 업로드 영역에 "업로드 위치: {현재 폴더 경로}" 표시 + "프로젝트 자료는 문서 › 파일에 프로젝트별로 저장됩니다" 안내 |
| FR-4 | 문서 업로드 한도 20MB → **50MB**(드라이브와 통일) |
| NFR | 새로 넣는 문구는 4개 언어(이 화면의 기존 한국어 하드코딩 중 손대는 표 머리글·업로드 창 문구도 함께 전환) |
