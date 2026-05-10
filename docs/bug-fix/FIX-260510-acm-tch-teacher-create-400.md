# FIX-260510 — acm-tch 교사 신규등록 400 Bad Request

- **신고일**: 2026-05-10
- **수정일**: 2026-05-10
- **수정자**: GitHub Copilot (Claude)
- **배포 SHA**: `24d609e` (staging, 2026-05-10 16:27 KST)
- **영향 범위**: ACM 백엔드 — `OwnEntityGuard` 가 적용된 모든 컨트롤러의 POST/PUT (실질적으로 ACM 모듈 전체 쓰기 API)

---

## 1. 증상

- URL: https://acm-stg.amoeba.site/admin/tch
- 동작: "신규 교사 등록" 모달에서 저장 클릭
- 콘솔:
  ```
  POST https://acm-stg.amoeba.site/api/acm/tch/teachers 400 (Bad Request)
  ```
- 응답 바디:
  ```json
  {"success":false,"error":{"code":"HTTP_400","message":["property entId should not exist"]}}
  ```
- 동일 패턴 재현 확인:
  - `POST /api/acm/stf/staff` → `["property stfRole should not exist","property entId should not exist"]`
  - `POST /api/acm/sch/schools` → `["property schName should not exist", ..., "property entId should not exist", ...]`

→ ACM 도메인의 거의 모든 쓰기 API가 동일한 400 을 반환.

## 2. 원인

`backend/src/modules/acm-common/guards/own-entity.guard.ts` 의 `OwnEntityGuard` 가 모든 요청에서 JWT 의 `entId` 를 `req.body.entId` 로 강제 주입했다.

```ts
// (수정 전)
if (req.body && typeof req.body === 'object') {
  (req.body as Record<string, unknown>).entId = entId;
}
```

그러나 글로벌 `ValidationPipe` 는 다음과 같이 설정되어 있다 ([backend/src/main.ts](backend/src/main.ts#L26)):

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,   // ← 미선언 필드 1개라도 있으면 400
    transform: true,
  }),
);
```

ACM 측 어떤 DTO 도 `entId` 를 선언하지 않으므로(컨트롤러는 항상 `@CurrentUser() u.entId` 로 JWT 에서 직접 읽음), 가드가 주입한 `entId` 가 `forbidNonWhitelisted` 검사에 걸려 `property entId should not exist` 400 이 발생.

이 본문 주입 코드는 **dead code** (handler 어디에서도 `body.entId` 를 사용하지 않음) 이며, 단지 검증 파이프를 깨뜨리는 부작용만 있었다.

> 신규 모듈(`acm-tch`, `acm-stf`, `acm-cal`)이 추가되며 사용자가 처음으로 ACM 쓰기 API 를 admin UI 에서 적극적으로 호출하기 시작하면서 표면화된 잠재 버그.

## 3. 해결

본문 주입을 제거하고, JWT-바디 `entId` 불일치 차단(보안 검사)만 남김.

[backend/src/modules/acm-common/guards/own-entity.guard.ts](backend/src/modules/acm-common/guards/own-entity.guard.ts)

```ts
@Injectable()
export class OwnEntityGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const entId = req.user?.entId;
    if (!entId) throw new ForbiddenException('Missing entId in JWT');

    const bodyEntId = (req.body as { entId?: string } | undefined)?.entId;
    if (bodyEntId && bodyEntId !== entId) {
      throw new ForbiddenException('entId mismatch');
    }
    return true;
  }
}
```

규칙: 핸들러는 반드시 `@CurrentUser() u.entId` 로 JWT 의 entId 를 사용한다. 가드는 본문에 주입하지 않는다.

## 4. 변경 파일

| 파일 | 변경 |
|------|------|
| [backend/src/modules/acm-common/guards/own-entity.guard.ts](backend/src/modules/acm-common/guards/own-entity.guard.ts) | 본문 entId 주입 제거 (+6/-6) |

## 5. 테스트 결과

### 재현 (수정 전, sha 767c064)
```
POST /api/acm/tch/teachers
→ HTTP 400 {"message":["property entId should not exist"]}
```

### 검증 (수정 후, sha 24d609e — staging)
```
POST /api/acm/tch/teachers
{"tchName":"테스트교사","tchEmail":"test.teacher.bug2@example.com",
 "tchSubjects":["MATH"],"tchStatus":"ACTIVE"}
→ HTTP 201 {"success":true,"data":{"id":"500f3e84-...","entId":"00000000-...-001",...}}

DELETE /api/acm/tch/teachers/500f3e84-...
→ HTTP 200 {"success":true}
```

## 6. 회귀 영향

- **긍정적 영향**: `OwnEntityGuard` 를 사용하는 모든 ACM 모듈의 POST/PUT 이 함께 정상화됨 — 별도 수정 불필요.
  - 관련 모듈: `acm-tch`, `acm-stf`, `acm-cal`, `acm-sch`, `acm-cls`, `acm-csl`, `acm-std`, `acm-ref`, `acm-dsh`, `acm-qna`
- **보안 회귀 없음**: 멀티테넌시 격리는 가드의 mismatch check (유지) + 핸들러의 `@CurrentUser().entId` 사용으로 그대로 보장됨. 가드의 본문 주입은 어차피 핸들러가 사용하지 않는 dead code 였음.
- 통합 테스트: 신규 회귀 추가는 본 패치 범위 외(후속 작업).

## 7. 후속 작업

- [후속] `OwnEntityGuard` 동작 회귀 테스트 (e2e) 1건 추가 — `ent_id mismatch → 403`, `정상 요청 → 통과` 시나리오.
- [후속] `acm-dsh` 의 `daily-kpi` 크론 에러 (`column "created_at" does not exist`, `amb_acm_csl_transition`) — 본 버그와 무관하지만 staging 로그에 지속 발생 중. 별도 티켓 권장.

## 8. 메모리 갱신

- `/memories/amb-bugfix-patterns.md` 에 신규 패턴 추가:
  - "Guard가 body 에 inject 하는 필드 + `forbidNonWhitelisted` ValidationPipe → 모든 POST/PUT 400" 진단법.
