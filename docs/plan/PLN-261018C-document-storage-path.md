---
document_id: ACM-DOC-STORAGE-PATH-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-18
related: REQ-261018C-document-storage-path
change_log:
  - version: 1.1.0
    date: 2026-10-18
    description: Approved (진행) / 승인
  - version: 1.0.0
    date: 2026-10-18
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# Work Plan (작업 계획) — 저장 위치 표시

## 1. Mockups (화면 구성안)

업로드 창(문서 › 파일, 프로젝트 › 자료):
```
파일 업로드
저장 위치
 (●) Google Drive   📁 TPI-New › 학원운영
 ( ) ACM 저장소      ACM 서버에만 저장 (Google Drive 에 보이지 않음)
파일 [선택…]   최대 50MB
```

문서 › 파일 목록:
```
문서명        프로젝트   저장 위치                         최종 수정   작성자  크기
test4.png    학원운영   📁 Drive › TPI-New › 학원운영 ↗    10-17 15:33  …     120KB
Screenshot…  학원운영   🗄 ACM 저장소                      10-16 14:03  …      88KB
```

드라이브 화면 업로드 영역:
```
[⬆ 업로드]  업로드 위치: TPI-New › 2026 자료
ⓘ 프로젝트 자료는 문서 › 파일에 프로젝트별 폴더(TPI-New › 프로젝트명)로 저장됩니다.
```

## 2. Work Packages

| WP | 내용 |
| --- | --- |
| WP1 API | 프로젝트 목록·문서 목록에 프로젝트 폴더 정보(`drive_folder_id`, 폴더명) 포함. 폴더명은 Google 에서 1회 조회해 `amb_acm_prj_project.drive_folder_name` 에 저장(이후 재사용) — `sql/acm/1047`. 한도 50MB(컨트롤러 2곳·서비스·화면) |
| WP2 화면 | 업로드 창 경로 표시, 문서 목록 "저장 위치" 열·Drive 폴더 링크, 드라이브 업로드 위치 안내. 4개 언어 |
| WP3 테스트·배포 | 통합 테스트(폴더명 저장·한도), PR → CI → 스테이징 → 운영 |
