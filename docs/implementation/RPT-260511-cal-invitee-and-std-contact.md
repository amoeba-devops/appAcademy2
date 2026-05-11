# RPT-260511 — 캘린더 참석자 + 학생 이메일/학부모 (Calendar Invitees & Student Email/Parents)

> **Type**: 작업 완료 보고서 (Work Report)
> **Date**: 2026-05-11
> **Related**:
> - REQ-260511-cal-invitee-and-std-contact.md
> - PLN-260511-cal-invitee-and-std-contact.md
> - TC-260511-cal-invitee-and-std-contact.md

---

## 1. Scope (범위)

ACM 모듈에 다음 기능을 추가:

1. **캘린더 작성자(강사) 표시** — 월간 뷰 chip / 상세 모달에 작성자 이름 + 이메일 노출
2. **참석자 등록** — 학생/강사/학부모를 일정에 N:M 등록, 참석자 chip + 알림 상태 배지
3. **이메일 안내** — SMTP 기반, 신규 추가 참석자에게 nodemailer로 일정 안내 메일 발송
4. **학생관리 이메일 필드** — `std_email` 컬럼 + 폼 입력
5. **학부모 등록** — 별도 엔티티 N:M(`amb_acm_std_parent` + `amb_acm_std_student_parent`), 학생 폼 내 sub-form

---

## 2. Changed Files (변경 파일)

### Database (1 file)
- [sql/acm/840-acm-cal-invitee-and-std-contact.sql](sql/acm/840-acm-cal-invitee-and-std-contact.sql) (NEW) — 4-step idempotent migration: `std_email` 컬럼, `amb_acm_std_parent`, `amb_acm_std_student_parent`, `amb_acm_cal_invitee`

### Backend — acm-std (7 files)
- [backend/src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity.ts](backend/src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity.ts) — `email` 컬럼 추가
- [backend/src/modules/acm-std/infrastructure/typeorm/parent.typeorm-entity.ts](backend/src/modules/acm-std/infrastructure/typeorm/parent.typeorm-entity.ts) (NEW)
- [backend/src/modules/acm-std/infrastructure/typeorm/student-parent.typeorm-entity.ts](backend/src/modules/acm-std/infrastructure/typeorm/student-parent.typeorm-entity.ts) (NEW)
- [backend/src/modules/acm-std/application/dto/student.dto.ts](backend/src/modules/acm-std/application/dto/student.dto.ts) — `stdEmail` + `stdParents[]` 추가
- [backend/src/modules/acm-std/application/dto/parent.dto.ts](backend/src/modules/acm-std/application/dto/parent.dto.ts) (NEW)
- [backend/src/modules/acm-std/application/parent.service.ts](backend/src/modules/acm-std/application/parent.service.ts) (NEW) — CRUD + `syncForStudent()` + `listForStudent()`
- [backend/src/modules/acm-std/application/student.service.ts](backend/src/modules/acm-std/application/student.service.ts) — email 매핑 + parents sync 통합, `findOne`/`create`/`update` response에 `parents` 포함
- [backend/src/modules/acm-std/presentation/parent.controller.ts](backend/src/modules/acm-std/presentation/parent.controller.ts) (NEW) — `/acm/std/parents` REST
- [backend/src/modules/acm-std/acm-std.module.ts](backend/src/modules/acm-std/acm-std.module.ts) — entity/service/controller 등록, ParentService export

### Backend — acm-cal (6 files)
- [backend/src/modules/acm-cal/infrastructure/typeorm/cal-invitee.typeorm-entity.ts](backend/src/modules/acm-cal/infrastructure/typeorm/cal-invitee.typeorm-entity.ts) (NEW)
- [backend/src/modules/acm-cal/application/dto/cal-event.dto.ts](backend/src/modules/acm-cal/application/dto/cal-event.dto.ts) — `evtInvitees`, `CalInviteeInputDto`, `ListInviteeCandidatesQueryDto`
- [backend/src/modules/acm-cal/application/cal-invitee.service.ts](backend/src/modules/acm-cal/application/cal-invitee.service.ts) (NEW) — diff/apply/hydrate/searchCandidates
- [backend/src/modules/acm-cal/application/cal-event.service.ts](backend/src/modules/acm-cal/application/cal-event.service.ts) — owner name/email lookup, invitee diff & notify, `notifySummary` 반환
- [backend/src/modules/acm-cal/application/invitee-notifier.service.ts](backend/src/modules/acm-cal/application/invitee-notifier.service.ts) (NEW) — 이메일 알림 + 상태 기록 (SENT / SKIPPED_NO_EMAIL / SKIPPED_NO_SMTP / FAILED)
- [backend/src/modules/acm-cal/presentation/cal-invitee-candidate.controller.ts](backend/src/modules/acm-cal/presentation/cal-invitee-candidate.controller.ts) (NEW) — `GET /acm/cal/invitee-candidates`
- [backend/src/modules/acm-cal/acm-cal.module.ts](backend/src/modules/acm-cal/acm-cal.module.ts) — 신규 entity/service/controller 등록

### Backend — Mailer (3 files)
- [backend/src/infrastructure/mailer/mailer.service.ts](backend/src/infrastructure/mailer/mailer.service.ts) (NEW) — nodemailer transporter, no-op when SMTP unconfigured
- [backend/src/infrastructure/mailer/mailer.module.ts](backend/src/infrastructure/mailer/mailer.module.ts) (NEW) — `@Global()`
- [backend/src/app.module.ts](backend/src/app.module.ts) — `MailerModule` 등록
- [backend/package.json](backend/package.json) — `nodemailer`, `@types/nodemailer`
- [backend/.env.example](backend/.env.example) — `SMTP_*`, `ACM_PORTAL_URL`

### Frontend — std (3 files)
- [frontend-acm/src/modules/std/types.ts](frontend-acm/src/modules/std/types.ts) — `email`, `ParentWithLink`, `ParentInput`
- [frontend-acm/src/modules/std/components/std-form-modal.tsx](frontend-acm/src/modules/std/components/std-form-modal.tsx) — 전화번호 라벨, 이메일 필드, ParentSubform mount, 제출 sanitization
- [frontend-acm/src/modules/std/components/parent-subform.tsx](frontend-acm/src/modules/std/components/parent-subform.tsx) (NEW) — `useFieldArray` 기반 학부모 카드 리스트

### Frontend — cal (4 files)
- [frontend-acm/src/modules/cal/types.ts](frontend-acm/src/modules/cal/types.ts) — `CalInviteeView`, `InviteeCandidate`, `NotifySummary`, owner/inviteeCount
- [frontend-acm/src/modules/cal/hooks/use-cal-events.ts](frontend-acm/src/modules/cal/hooks/use-cal-events.ts) — `useInviteeCandidates`
- [frontend-acm/src/modules/cal/components/cal-event-modal.tsx](frontend-acm/src/modules/cal/components/cal-event-modal.tsx) — 작성자 메타, 참석자 섹션, 알림 결과, picker 연동, detail 자동 fetch
- [frontend-acm/src/modules/cal/components/invitee-picker-modal.tsx](frontend-acm/src/modules/cal/components/invitee-picker-modal.tsx) (NEW)
- [frontend-acm/src/modules/cal/pages/cal-month-page.tsx](frontend-acm/src/modules/cal/pages/cal-month-page.tsx) — chip에 `[ownerName]` prefix + 참석자 수 표시

### i18n (8 files — ko/en/vi/zh-CN × std·cal)
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/std.json` — `field.email`, `field.phone`, `field.parent*`, `form.sectionParents`, `form.parentsEmpty`, `form.addParent`
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/cal.json` — `field.creator`, `form.sectionAttendees`, `invitee.*`

---

## 3. Test Results (테스트 결과)

### 3.1 Build verification (자동)
| Project | Command | Result |
|---------|---------|--------|
| backend | `npm run build` | ✅ PASS (TS strict, ESLint boundaries) |
| frontend-acm | `npm run build` | ✅ PASS (`tsc -b && vite build`, 1.65s) |

### 3.2 Manual TC 실행 — **미실행**
TC-260511 의 시나리오는 SMTP 환경(MailHog 등)과 staging DB 시드가 필요하여 본 보고서 시점에는 실행하지 않았다. 다음 단계에서 사용자가 staging 환경에서 실행 후 결과를 보고서 §6 Follow-ups 항목에 갱신한다.

### 3.3 회귀 영향 (Regression)
- **CAL list/detail API 응답 shape 확장** — 기존 필드는 모두 유지, `ownerName`/`ownerEmail`/`inviteeCount`/`invitees`/`notifySummary`만 추가. 기존 frontend가 무시해도 안전.
- **STD create/update API 응답 shape 확장** — `email`, `parents` 추가. 동일하게 기존 필드 유지.
- **CLS_SESSION 소스 일정** — 참석자 등록 UI는 `disabled` (READ_ONLY_SOURCE 가드와 일치).
- **TypeORM 이중 등록** — `StudentTypeormEntity`/`ParentTypeormEntity`/`TeacherTypeormEntity`/`AcmUserTypeormEntity`가 `AcmStdModule`/`AcmTchModule`/`AcmAuthModule`/`AcmCalModule` 양쪽에 forFeature 등록. NestJS는 동일 datasource 내 중복 forFeature를 허용하므로 무해.

---

## 4. Security & Privacy

| Item | Status |
|------|--------|
| 이메일 주소 PII 처리 | DB 평문 저장(요구사항 외 - 추후 암호화 검토 필요) |
| Cross-tenant 검증 | `CalInviteeService.assertSameTenant()` — 모든 invitee.refId가 actor `entId`에 속하는지 확인 |
| SMTP 자격증명 | env-only, 코드 하드코딩 없음 |
| 권한 가드 | `@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)` 모든 신규 controller에 적용 |
| TEACHER 권한 | 본인 소유 일정만 invitee 변경 가능 (기존 `assertCanMutate` 재사용) |

---

## 5. Migration Steps (배포 순서)

1. `psql ... -f sql/acm/840-acm-cal-invitee-and-std-contact.sql` 실행 (idempotent)
2. backend `npm install` (nodemailer 의존성)
3. `.env` 에 SMTP_HOST, SMTP_FROM, ACM_PORTAL_URL 설정 (선택 — 비워두면 SKIPPED_NO_SMTP)
4. backend 재시작
5. frontend-acm 재배포

---

## 6. Follow-ups (후속 작업)

- [ ] **Manual TC 실행** — staging 환경 + MailHog로 TC-260511 시나리오 실행, 결과 별도 TR 보고서로 첨부
- [ ] **이메일 PII 암호화** — `std_email`, `par_email` 컬럼 암호화 검토 (현재 평문)
- [ ] **AmoebaTalk 이중채널** — 향후 알림을 SMTP + AmoebaTalk 동시 발송 옵션 검토
- [ ] **참석자 본인 응답 (RSVP)** — 본 v1에서 미포함, 후속 요구사항 발생 시 별도 진행
- [ ] **frontend-acm bundle splitting** — vite 빌드 경고(862KB), 후속 최적화

---

## 7. Memory / Doc Update

- `/memories/repo/trinity-academy-project.md` 갱신 불요 (기존 패턴 준수, 신규 컨벤션 없음)
- 본 RPT 가 단일 source of truth
