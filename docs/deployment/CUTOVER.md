---
document_id: APP-ACADEMY-CUTOVER-1.0.0
version: 1.0.1
status: Archived Reference
created: 2026-04-27
audience: Ops on-call + Tech Lead
---

# app-academy — Production Cut-over Checklist (프로덕션 컷오버)

S5-7 산출물. UAT 전 항목 PASS 확인 후 production 첫 출시 또는 도메인 전환 시 사용한다.

> **2026-07-04 아카이브 안내**: 이 문서는 MySQL legacy 전환기 cut-over 체크리스트를 포함한다. 현재 기본 운영 기준은 PostgreSQL-only 이며, 실제 배포는 현재 compose와 `scripts/deploy-*.sh` 기준으로 수행한다.

> **Reference**: [docs/deployment/RUNBOOK.md](RUNBOOK.md), [docs/test/UAT-CHECKLIST.md](../test/UAT-CHECKLIST.md)

---

## T-7d (1주 전)

- [ ] UAT-A/B/C/D 전체 PASS + sign-off 완료
- [ ] AMA App Store 등재 자료([docs/appstore/](../appstore/)) 검수 완료, 마켓 팀에 제출
- [ ] 외부 모니터(Better Uptime 등)에 `https://app-academy.amoeba.site/` health check 사전 등록 (페이지 down 알림 only — 출시 후 활성화)
- [ ] 운영자 공지 초안 작성 (학원장 대상 — 새 도메인, 로그인 방법, 문의처)

## T-3d

- [ ] DNS A 레코드 `app-academy.amoeba.site` → production host IP, **TTL 300** 으로 사전 설정
- [ ] `*.amoeba.site` 와일드카드 인증서 만료일 확인 (60일 이상 남아야 함)
- [ ] `docker/production/.env.production` 의 모든 시크릿이 production 값인지 확인 (`AMA_JWT_SECRET` 16+ chars, `AMA_WEBHOOK_SECRET` 실 값, `JWT_SECRET`/`NEXTAUTH_SECRET` 32+ chars)
- [ ] GitHub Settings → Environments → `production` 리뷰어 최소 2명 등록 확인
- [ ] cron 설치 확인: `crontab -l | grep backup-db`

## T-1d

- [ ] Production host 사전 점검:
  ```bash
  ssh prod
  df -h /var/lib/app-academy /var/backups   # >40% 여유
  docker ps --filter name=tac-prod-          # 빈 상태여야 정상 (첫 출시)
  sudo nginx -t                              # 기존 설정 정상
  ```
- [ ] Production 호스트에 코드 사전 clone:
  ```bash
  ssh prod
  git clone https://github.com/amoeba-devops/appAcademy2 ~/app-academy
  cd ~/app-academy && git checkout main
  cp docker/production/.env.production.example docker/production/.env.production
  vi docker/production/.env.production  # 실 시크릿 입력
  ```
- [ ] 첫 배포는 어차피 빈 DB이므로 사전 백업 N/A. 두 번째부터는 자동 백업이 동작함을 확인.

## T-0 (Cut-over Day)

### Phase 1 — 인프라 기동 (T-0 ~ T+30min)

1. [ ] **현재 상태 스냅샷** — staging의 `git rev-parse HEAD` 기록 (rollback ref)
2. [ ] Actions → **CD — Production** → Run workflow
   - `sha`: 위에서 기록한 7-char SHA
   - `skip_smoke`: false
3. [ ] Environment approval (리뷰어 2명)
4. [ ] Workflow 진행 모니터링 — preflight → deploy → smoke test 모두 green
5. [ ] 호스트 직접 확인:
   ```bash
   ssh prod
   docker ps --filter name=tac-prod-          # 4개 컨테이너 healthy
   curl -sIL https://app-academy.amoeba.site/ | head -3   # 200 OK
   docker logs tac-prod-backend --tail 50    # ERROR 0건
   ```
6. [ ] DB 초기 스키마 적용 확인:
   ```bash
   docker exec tac-prod-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" db_tac \
     -e "SHOW TABLES;" | wc -l               # >50 (전체 스키마)
   ```

### Phase 2 — 첫 입주 테넌트 (T+30min ~ T+2h)

7. [ ] AMA Ops에게 첫 production webhook 1건 요청 (`subscription.created`, `acdAmaTenantId=PROD-LAUNCH-001`)
8. [ ] DB 확인:
   ```sql
   SELECT acd_id, acd_name, acd_ama_tenant_id, acd_subscription_status
     FROM tac_academies WHERE acd_ama_tenant_id='PROD-LAUNCH-001';
   ```
9. [ ] 운영자 계정으로 AMA SSO 로그인 → onboarding 완료 → dashboard 진입
10. [ ] 학생 1건 등록 → 환불정책 확인 (4 tier preset)

### Phase 3 — 모니터링 활성 (T+2h)

11. [ ] 외부 health check 알림 활성화 (T-7d에 등록한 항목)
12. [ ] 로그 5분간 tail — 5xx 0건 확인
    ```bash
    docker logs tac-prod-backend --since 5m --tail 200 | grep -E '5[0-9]{2}'
    ```
13. [ ] 운영자 공지 발송

### Phase 4 — 포스트 (T+24h)

14. [ ] 24시간 후 자동 백업 1건 생성 확인:
    ```bash
    ls -lh /var/backups/app-academy/production/
    ```
15. [ ] 첫 백업 복구 리허설 (별도 staging DB로) — 무결성 확인
16. [ ] DNS TTL을 300 → 3600 으로 상향
17. [ ] 회고 노트 — 본 체크리스트에서 어긋난 항목 기록

---

## Rollback Trigger (롤백 발동 조건)

다음 중 하나라도 발생하면 즉시 [RUNBOOK §4](RUNBOOK.md) 따라 롤백:
- Smoke test 3회 연속 실패
- backend 로그에 stacktrace 포함된 ERROR가 분당 5건 이상
- AMA webhook이 401/500 응답
- DB connection pool exhaustion
- 운영자 로그인 불가 신고 1건 이상

## Hard Stop (절대 중단 조건)

- 결제 데이터 손상 의심 → 즉시 모든 쓰기 차단 + AMA Ops + Toss 동시 통보
- 데이터 leakage 의심 (다른 테넌트 데이터가 노출) → DB read-only 모드 + 사고 대응 절차

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Ops On-call | | | |
| Product Owner | | | |
