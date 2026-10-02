---
document_id: ACM-ADMIN-SUPPORT-TOGGLE-PLN-1.0.0
version: 1.0.0
status: Deployed
created: 2026-10-02
change_log:
  - version: 1.0.0
    date: 2026-10-02
    description: Shared visibility control and layout proposal / 공통 가리기 및 화면 구성안
---

# Admin Support Panel Toggle Plan (관리자 우측 패널 가리기 계획)

## 1. Scope (범위)

[요구사항](../analysis/REQ-261002B-admin-support-panel-toggle.md)에 따라 frontend-acm 공통 레이아웃에서 구현한다. 기존 미커밋 변경을 보존하고 최신 운영 코드 기반 격리 작업 공간을 사용한다.

## 2. Screen Proposal (화면 구성안)

표시 상태:

```text
좌측 메뉴 │ 본문: 수납관리·검색·목록       │ 이용 팁 [가리기 →]
          │                              │ 도움말 / 배너
```

숨김 상태:

```text
좌측 메뉴 │                       [← 우측 패널 보이기]
          │ 본문: 수납관리·검색·목록 (가용 폭 사용)
```

좁은 화면은 기존 본문 아래 패널 배치를 유지하되 같은 가리기 동작을 제공한다. 가린 패널은 화면 크기가 바뀌어도 자동으로 다시 열지 않는다.

## 3. Implementation (구현 단계)

1. AdminContentLayout에 공통 표시 상태 및 사용자/테넌트별 브라우저 저장 키를 추가한다. 초기값은 표시, 저장 실패는 안전하게 처리한다.
2. AdminSupportPanel에 가리기 동작을 연결하고 공통 레이아웃에 보이기 버튼을 추가한다. 본문 DOM 구조를 유지한다.
3. globals.css에 숨김 상태의 단일 열/가용 폭 스타일을 추가한다. 기존 표시 상태 레이아웃은 유지한다.
4. common 번역 파일 ko/en/vi/zh-CN에 버튼명과 접근성 문구를 추가한다.
5. 수납·상담·학생·캘린더·채팅·설정에서 공통 적용 및 대시보드 제외를 확인한다. 넓은/좁은 화면, 새로고침/페이지 이동, 입력값 유지, 키보드, 가로 넘침을 검증한다.
6. 프론트엔드 TypeScript/build 검증 및 로컬 화면 증빙 후 보고한다. 운영 배포는 별도 배포 요청에 따라 수행한다.

## 4. Approval (확인)

AGENTS.md §9.2의 “요구사항 분석서 + 작업 계획서 작성 후 반드시 사용자 확인을 받은 후 구현으로 진행한다”에 따라 현재는 분석·화면 구성안 작성 단계다. 이번 새 요구사항에 대한 사용자 확인 후 구현한다.

2026-10-02 사용자 “구현 진행” 승인 후 구현 및 로컬 공통 레이아웃 검증 완료. 2026-10-02 운영 배포 완료.


## Production Release — 2026-10-02 (운영 배포)

- 사용자 “운영 배포” 승인에 따라 월별 수납/통계 및 공통 우측 패널 기능을 함께 배포했다.
- PR [#296](https://github.com/amoeba-devops/appAcademy2/pull/296), 운영 버전 `0fe757e80dbaacb8e6768e2c04d937d8678338cf`.
- 배포 시각: **2026-10-02 22:55:44 KST**.
- [CI](https://github.com/amoeba-devops/appAcademy2/actions/runs/37015461656), [스테이징](https://github.com/amoeba-devops/appAcademy2/actions/runs/37015913231), [운영](https://github.com/amoeba-devops/appAcademy2/actions/runs/37016213235) 모두 성공. continue-on-error 단계도 실패 없음.
- 운영/스테이징 백업 생성 및 pg_restore 목록 확인, 권한 600. 신규 DB migration 없음.
- 운영 backend/frontend 이미지 모두 `0fe757e`, running, restarts=0. 확인 시점 최근 3분 backend ERROR 0건. 장기 모니터링 결과는 아니다.
- 운영 공개 주소에서 월별 API 경로·통계·패널 문구가 포함된 최신 JS 번들 제공 확인.
- 운영 브라우저 로그인 세션 만료로 로그인 후 화면 직접 확인은 대기 중이다. 아래 검증은 실제 배포된 인증 API 및 컨테이너/정적 번들 확인이며, 본문 캡처는 로컬 검증 화면이다.
