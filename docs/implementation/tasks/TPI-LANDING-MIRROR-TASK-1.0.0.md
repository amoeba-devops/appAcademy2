---
document_id: TPI-LANDING-MIRROR-TASK-1.0.0
version: 1.0.0
status: COMPLETED
date: 2026-05-07
---

# tpi.amoeba.site → tpi.co.kr 랜딩 미러 (Task Report)

## 1. Background (배경)

`tpi.amoeba.site`는 2026-04 AMA App Store 피벗 직후부터 `app-academy-stg.amoeba.site`로 단순 301 redirect만 수행하던 임시 vhost였다(T+6mo 일몰 예정). 운영진 결정으로 해당 호스트에 `tpi.co.kr` 마케팅 랜딩을 그대로 미러링하여 도메인을 활용하기로 함.

## 2. Decisions (의사결정)

| 항목 | 결정 | 근거 |
|------|------|------|
| 라우팅 | host nginx에서 `/` → `/web/` 내부 rewrite 후 acm-frontend 컨테이너로 프록시 | 별도 컨테이너·CI 파이프라인 불필요, 정적 자산만 추가 |
| 자산 확보 | `wget --mirror`로 `www.tpi.co.kr` 미러링 + 외부 CDN 이미지 일괄 다운로드 | "그대로 구현" 원칙 충족 |
| i18n | ko 단일 (정적 미러) | 향후 SPA 통합 시 i18n 도입 (메모리 규칙 예외 명시) |

## 3. Changes (변경 내역)

### 3.1 신규 파일 (`frontend-acm/public/web/`)
| 파일 | 출처 |
|------|------|
| `index.html` | `tpi.co.kr/` |
| `contact.html` | `tpi.co.kr/contact` |
| `test.html` | `tpi.co.kr/test` |
| `isee.html` | `tpi.co.kr/isee` |
| `policy.html` | `tpi.co.kr/?mode=policy` |
| `privacy.html` | `tpi.co.kr/?mode=privacy` |
| `assets/images/` | 143개 (cdn.imweb.me 100, i.ifh.cc 38, r2.dev 4, www.tpi.co.kr 1) |
| `assets/{css,js,common,_imweb}/` | imweb 프레임워크 정적 자산 |

총 추가 용량: **약 36MB** (HTML 5MB + 이미지 29MB + 프레임워크 2MB)

### 3.2 URL 치환 규칙
정리 스크립트 `/tmp/rewrite-tpi.py` 적용 결과:
- `https://cdn.imweb.me/...`, `https://i.ifh.cc/...`, `https://pub-...r2.dev/...` → `/web/assets/images/<basename>`
- `https://(www.)tpi.co.kr/{css,js,common,_}/...` → `/web/assets/{css,js,common,_imweb}/...`
- 내부 라우트(`/contact`, `/test`, `/isee`, `?mode=policy|privacy`) → 로컬 `.html` 파일

### 3.3 수정 파일
- `docker/staging/nginx-tpi.conf` — 301 redirect 제거, `/web/` 프리픽스 rewrite + acm-frontend 프록시로 재작성
- `docs/deployment/staging.md` — §1 hostname 표 업데이트, tpi.amoeba.site 역할 변경 명시

## 4. Routing Verification (라우팅 검증)

| 외부 URL | 컨테이너 내부 URI | 실제 파일 |
|----------|-------------------|-----------|
| `tpi.amoeba.site/` | `/web/index.html` | `dist/web/index.html` |
| `tpi.amoeba.site/contact.html` | `/web/contact.html` | `dist/web/contact.html` |
| `tpi.amoeba.site/assets/images/test01.png` | `/web/assets/images/test01.png` | `dist/web/assets/images/test01.png` |

## 5. Smoke Test (로컬)

```bash
cd frontend-acm && npm run build
# ✓ built in 1.71s, dist/web/ 36MB (143 images, 7 HTML)

cd dist && python3 -m http.server 8765
curl -sI http://127.0.0.1:8765/web/index.html       # 200, 1,033,584 bytes
curl -sI http://127.0.0.1:8765/web/contact.html     # 200
curl -sI http://127.0.0.1:8765/web/assets/images/test01.png  # 200

grep -c "트리니티\|MAP TEST\|/web/assets/images/" dist/web/index.html
# → 145 매칭 (콘텐츠·이미지 경로 정상)
```

## 6. Deploy Steps (배포 절차)

1. PR 머지 → main 푸시
2. 스테이징 호스트(`appacademy@125.133.49.165`)에서:
   ```bash
   cd ~/app-academy && git pull origin main
   docker compose -f docker/staging/docker-compose.staging.yml up -d --build acm-frontend
   sudo cp docker/staging/nginx-tpi.conf /etc/nginx/sites-available/tpi.amoeba.site
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. 검증:
   ```bash
   curl -I https://tpi.amoeba.site/                      # 200 (이전: 301)
   curl -I https://tpi.amoeba.site/assets/images/test01.png  # 200
   curl -I https://acm-stg.amoeba.site/                  # 200 (회귀 없음)
   curl -I https://app-academy-stg.amoeba.site/          # 200 (회귀 없음)
   ```

## 7. Known Limitations (알려진 제약)

| 항목 | 영향 | 대응 |
|------|------|------|
| imweb 백엔드 의존 위젯(로그인, 알림, 게시판 등) JS는 콘솔 에러 발생 | 마케팅 콘텐츠 렌더에는 영향 없음 | 향후 SPA 통합 시 정리 |
| 폼 제출(`/contact`, `/test`)이 정적 페이지로 작동 | KakaoTalk(`pf.kakao.com/_IaxbCn/chat`), 전화(`tel:15552108`) CTA 사용 가능 | 필요 시 backend `/api/portal/*` 연동 |
| 외부 CDN 이미지 저작권 | tpi.co.kr 운영 주체 동의 가정 | 별도 검토 시 placeholder 교체 |
| `nginx.conf.template` L29의 immutable 7d 캐시 | HTML 변경 시 캐시 갱신 지연 가능 | 필요 시 별도 cache-control 분기 추가 |
| 번들 크기 +36MB | git 저장소·CI 빌드 시간 증가 | 필요 시 LFS 또는 별도 R2 버킷 검토 |

## 8. Out of Scope

- 폼 백엔드 연동 (상담/시험 신청 → DB 저장)
- i18n 다국어
- SEO 최적화 (sitemap, structured data)
- 프로덕션 도메인(`tpi.co.kr` 자체) DNS 변경
