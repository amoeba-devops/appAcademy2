---
document_id: ACM-CHAT-NOTIFICATION-REQ-1.0.0
version: 1.0.0
status: Implemented; awaiting deployment
change_log:
  - version: 1.0.0
    description: Investigated mobile notification, unread badges and deep links.
---
# Mobile Chat Notifications (모바일 채팅 알림)

## 1. Request (요구사항)
모바일 알림 허용 후에도 알림이 오지 않는 현상을 조사한다. 사이트 내부 팝업뿐 아니라 미확인 채팅을 종·로비채팅·방 목록에서 확인하고, 알림 클릭 시 해당 방/메시지 또는 상담·일정 상세로 이동해야 한다.

## 2. Findings (확인 결과)
운영 버전 a95390c 및 API health 정상 확인(2026-10-13). 아래는 같은 배포 소스의 정적 조사이며, 사용자의 실제 기기/계정에서 현상을 재현한 결과는 아니다.

| 항목 | 확인된 구현과 영향 |
|---|---|
| 백그라운드 알림 | ACM 앱에 Service Worker, Push subscription, Web Push 발송 구현 없음. 사이트 내부 SSE 토스트만 존재. 브라우저 허용만으로 앱 종료 후 알림을 받을 수 없음 |
| 종 알림 | 상담·일정·CHAT_MENTION만 적재. 일반 텍스트/파일 채팅은 종 알림 미적재 |
| 채팅 숫자 | AppShell과 방 목록에 이미 unreadCount 배지 존재. 사이드바 아이콘 모드는 숫자 대신 점, 모바일 메뉴를 닫으면 사이드바 숫자는 보이지 않음. 사용자 계정에서 0인 직접 원인은 미확정 |
| 읽음 처리 | ChatPane은 lastId가 바뀌면 document.visibilityState/실제 방 노출 여부 확인 없이 markRead 호출. 백그라운드 SSE·폴링으로 미확인 메시지가 읽음 처리될 가능성 |
| 읽음 경계 | 서버 markRead가 현재 시각을 저장해, 요청 사이에 도착한 미표시 메시지까지 읽음 처리될 가능성 |
| 토스트 클릭 | AdminRealtime은 /admin/chat으로만 이동, channelId/messageId 누락 |
| 토스트 표시 | /admin/chat 경로 전체에서 토스트 억제. 다른 방을 보고 있는 경우도 알림 억제 |
| 기존 종 바로가기 | inbox read 응답은 상담/일정 상세 및 channelId/messageId 포함 채팅 경로 제공. 해당 기능은 유지·회귀 검증 필요 |

근거: frontend-acm/src/components/layout/{admin-realtime,app-shell}.tsx, modules/talk/components/talk-chat.tsx, modules/notifications/components-inbox.tsx, backend/src/modules/acm-talk/application/talk.service.ts 및 acm-notification/application/inbox.service.ts.

## 3. Scope and Constraints (범위와 제약)
- 관리자 및 강사 포털의 기존 채팅 권한 내에서 제공. 본인 발신 제외, 탈퇴·추방 후 전달/접근 차단, 테넌트 격리 유지.
- 일반 채팅과 멘션 중복 알림 방지. 채팅 읽음과 채팅 알림 읽음은 같은 메시지 경계로 동기화하며 상담/일정 읽음과 분리.
- 기존 AMA 알림 전달과 직접 Web Push는 별도 경로. 일반 채팅 추가가 AMA 외부 전달을 무조건 확대하지 않도록 명시적 유형/설정 관리.
- iOS Web Push는 iOS 16.4 이상 홈 화면 웹 앱 조건 안내. 일반 탭은 설치 안내 제공. 출처: https://webkit.org/blog/13878/ 및 https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- 사용 기종/브라우저/설치 방식 질문 중. 이번 메시지에 언급된 화면 이미지는 첨부되지 않아 화면 비교 미실시.
- 운영 데이터 변경·테스트 메시지 전송·구현·배포는 이번 조사에서 수행하지 않음.

## 4. Additional Requirements (추가 요구사항)
- 캘린더 수업 종료 후 5시간 시점에 숙제 또는 피드백이 미완료이면 담당 강사와 같은 학원 관리자에게 1차 알림. 종료 후 10시간에도 미완료이면 2차 알림. 10시간은 1차 알림 이후가 아닌 수업 종료 기준이다.
- 강사 포털 피드백 영역 하단에 ‘학부모 메일 발송’ 버튼. 저장한 피드백을 해당 수업 학생의 연결 학부모에게 직접 발송.
- 조사: CAL 이벤트에 endAt, 담당강사, review(feedbackHtml/homeworkStatus/homeworkHtml), HOMEWORK 첨부가 존재한다. 현재 완료 표시는 feedbackHtml.trim 및 homeworkStatus 유무만 검사하므로 내용 없는 HTML/과제 상태만 지정한 경우를 보완해야 한다.
- CLS 모듈의 기존 SLA는 매일 09:00, HELD 후 24시간 지난 DRAFT 행만 조회한다. CAL 강사 포털의 5h/10h 검사나 review 미생성 수업 검사를 대체하지 않는다.
- FeedbackMailerService는 관리자용 수신자 조회·메일 발송·수신자 검증·발송 로그를 제공한다. PortalCalController에는 메일 API가 없으며, 담당강사 권한 검증 후 재사용할 수 있다. 기존 메일 본문은 피드백만 포함한다.
- 숙제 완료 정책 확정: 내용/파일 등록 또는 명시적 ‘숙제 없음’을 완료로 인정하는 안. 사용자가 이 기준으로 진행 승인.
