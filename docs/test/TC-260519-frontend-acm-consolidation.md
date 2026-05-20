---
document_id: TC-260519-frontend-acm-consolidation
version: 1.0.0
status: draft
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
related_doc: REQ-260519-frontend-acm-consolidation, PLN-260519-frontend-acm-consolidation
change_log:
  - 2026-05-19 — v1.0.0 — draft test cases (routing, auth, portal pages, parent pages, i18n, responsive)
---

# 테스트 케이스 — Frontend-ACM 통합 및 Parent Portal 기능 추가
## Test Cases — Frontend-ACM Consolidation, Parent Login, Portal Pages Integration

---

## 1. 개요 (Overview)

### 1.1 테스트 범위
- **Unit Tests**: 컴포넌트, 훅, util 함수 (선택적)
- **Integration Tests**: 라우팅, auth store, API 호출
- **E2E Tests**: 전체 사용자 플로우 (로그인, 페이지 이동, 폼 제출)
- **Smoke Tests**: Staging 배포 후 기본 기능 확인

### 1.2 테스트 우선순위
- **P0 (Critical)**: 라우팅, 인증, 마이페이지 접근 불가 시 서비스 마비
- **P1 (High)**: 각 페이지 콘텐츠 표시, 폼 제출, 데이터 조회
- **P2 (Medium)**: i18n 렌더링, responsive design, 에러 처리
- **P3 (Low)**: UI 세부 스타일, 애니메이션

---

## 2. Acceptance Criteria (AC) 별 테스트 케이스

### AC-1 | 기본 라우팅 (Basic Routing)
**관련 Requirements**: FR-01

#### TC-AC1-001 | 공개 경로 접근 (로그인 미필요)
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC1-001 |
| **Title** | Public pages are accessible without authentication |
| **Precondition** | 앱 시작, localStorage 비우기 (로그인 상태 없음) |
| **Steps** | 1. 브라우저에서 `http://localhost:3009/` 접속<br>2. 페이지 로드 대기 (< 3초)<br>3. Hero section 이미지, 제목, CTA 확인<br>4. `/about` 링크 클릭 후 로드 확인<br>5. `/programs` 링크 클릭<br>6. `/news` 링크 클릭 |
| **Expected Result** | 모든 경로에서 404 없이 페이지 렌더링, 콘텐츠 표시 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration / Smoke |
| **Priority** | P0 |

#### TC-AC1-002 | 보호 경로 미인증 접근 (리다이렉트)
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC1-002 |
| **Title** | Protected paths redirect to login when unauthenticated |
| **Precondition** | 앱 시작, localStorage 비우기 |
| **Steps** | 1. `/admin` 직접 접속<br>2. 브라우저에서 `/admin/dashboard` 직접 접속<br>3. `/my` 직접 접속<br>4. 각 경로에서 리다이렉트 확인 |
| **Expected Result** | `/admin` → `/login?returnTo=/admin/dashboard`<br>`/my` → `/login/parent?returnTo=/my` |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P0 |

#### TC-AC1-003 | 라우터 경로 매핑
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC1-003 |
| **Title** | All router paths defined in router.tsx are resolvable |
| **Precondition** | npm run dev 실행 중 |
| **Steps** | 1. 개발자 콘솔에서 각 경로 접속:<br>- `/` ✓<br>- `/login` ✓<br>- `/login/parent` ✓<br>- `/web/contact` ✓<br>- `/web/test` ✓<br>- `/about` ✓<br>- `/programs` ✓<br>- `/programs/1` (mock id) ✓<br>- `/news` ✓<br>- `/news/test-slug` (mock slug) ✓<br>- `/admin` (redirect to /login) ✓<br>- `/my` (redirect to /login/parent) ✓ |
| **Expected Result** | 모든 경로가 정상 라우팅, 404 없음 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Unit |
| **Priority** | P0 |

---

### AC-2 | 부모 로그인 (Parent Login)
**관련 Requirements**: FR-02

#### TC-AC2-001 | Parent 로그인 이메일 입력 및 OTP 발송
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC2-001 |
| **Title** | Parent login - send OTP to email |
| **Precondition** | `/login/parent` 페이지 로드 완료 |
| **Steps** | 1. 이메일 입력 필드에 "parent@example.com" 입력<br>2. "OTP 발송" 버튼 클릭<br>3. Loading spinner 표시 대기<br>4. 성공 메시지 또는 "OTP 입력" 필드 활성화 확인<br>5. 60초 타이머 시작 확인 |
| **Expected Result** | POST /api/web/auth/send-otp → 200<br>OTP 입력 필드 활성화<br>60초 카운트다운 시작<br>"재발송" 버튼 비활성화 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P0 |

#### TC-AC2-002 | Parent 로그인 OTP 검증 및 토큰 발급
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC2-002 |
| **Title** | Parent login - verify OTP and issue JWT |
| **Precondition** | TC-AC2-001 완료, OTP 입력 필드 활성화 상태 |
| **Steps** | 1. OTP 입력 필드에 "123456" 입력<br>2. "확인" 버튼 클릭<br>3. Loading spinner 표시 대기<br>4. 로그인 성공 후 `/my` 리다이렉트 확인<br>5. localStorage에 token 저장 확인 (DevTools → Application → localStorage) |
| **Expected Result** | POST /api/web/auth/verify-otp → 200<br>{ accessToken: "...", user: { role: "parent", ... } }<br>Zustand store에 user.role = "parent" 저장<br>localStorage에 token persist<br>`/my` 자동 리다이렉트 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration / E2E |
| **Priority** | P0 |

#### TC-AC2-003 | Parent 로그인 실패 - 유효하지 않은 OTP
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC2-003 |
| **Title** | Parent login - invalid OTP error handling |
| **Precondition** | OTP 입력 필드 활성화 상태 |
| **Steps** | 1. OTP에 "000000" (잘못된 값) 입력<br>2. "확인" 버튼 클릭<br>3. 에러 메시지 확인<br>4. `/my` 리다이렉트 없음 확인<br>5. 재시도 가능 여부 확인 |
| **Expected Result** | POST /api/web/auth/verify-otp → 401<br>에러 메시지 표시: "유효하지 않은 OTP입니다"<br>페이지 유지, 재입력 가능<br>localStorage 미변경 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC2-004 | Parent 로그인 재발송 기능
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC2-004 |
| **Title** | Parent login - OTP resend functionality |
| **Precondition** | OTP 발송 후 60초 타이머 진행 중 |
| **Steps** | 1. 타이머가 50초 이상일 때 "재발송" 버튼 클릭 시도<br>2. 버튼이 비활성화 상태 확인<br>3. 10초 경과 대기<br>4. 타이머 < 50초일 때 "재발송" 버튼 활성화 확인<br>5. 클릭 후 새 OTP 발송 API 호출 확인 |
| **Expected Result** | 재발송 버튼은 10초 경과 후 활성화<br>클릭 시 POST /api/web/auth/send-otp 호출<br>새 타이머 시작 (60초 리셋) |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC2-005 | Parent 로그인 타이머 만료 후 재입력
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC2-005 |
| **Title** | Parent login - OTP timeout handling |
| **Precondition** | OTP 발송 후 타이머 진행 중 |
| **Steps** | 1. 60초 타이머 만료 대기 (또는 mock)<br>2. OTP 입력 필드 비활성화 확인<br>3. "재발송" 버튼 클릭 강제 실행<br>4. 새 OTP 입력 필드 활성화 |
| **Expected Result** | 60초 타이머 만료 시 OTP 입력 필드 자동 비활성화<br>"재발송" 버튼 클릭 → 새 OTP 발송<br>새 타이머 시작 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P2 |

#### TC-AC2-006 | Parent 로그인 후 새로고침 시 세션 유지
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC2-006 |
| **Title** | Parent session persists after page refresh |
| **Precondition** | Parent 로그인 완료, `/my` 페이지 표시 중 |
| **Steps** | 1. F5 또는 Cmd+R 새로고침<br>2. localStorage 확인: token 존재<br>3. Zustand store 확인: user.role = "parent"<br>4. 페이지 새로고침 후 `/my` 표시 확인 (로그인 페이지로 리다이렉트 안 됨) |
| **Expected Result** | localStorage의 token 유지<br>새로고침 후 즉시 `/my` 렌더링<br>splash/loading 화면 최소화 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

---

### AC-3 | 마이페이지 (Parent Dashboard)
**관련 Requirements**: FR-03

#### TC-AC3-001 | /my 메인 대시보드 데이터 로드
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC3-001 |
| **Title** | Parent dashboard loads and displays summary data |
| **Precondition** | Parent 로그인 완료 |
| **Steps** | 1. `/my` 페이지 로드<br>2. 자녀 드롭다운 선택 확인<br>3. 프로그램, 결제 현황, 최근 성적, 주간 시간표 카드 로드 확인<br>4. 각 섹션의 "더보기" 또는 세부 페이지 링크 확인 |
| **Expected Result** | GET /api/my /* API 호출 성공<br>모든 섹션 데이터 표시<br>링크 정상 작동 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P0 |

#### TC-AC3-002 | /my/payments 결제 이력 조회
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC3-002 |
| **Title** | Payments page displays payment history with filtering |
| **Precondition** | Parent 로그인, `/my/payments` 접근 |
| **Steps** | 1. 결제 이력 테이블 로드<br>2. 날짜 필터 입력 후 재조회<br>3. 상태 필터(PAID/PENDING/REFUNDED) 선택<br>4. 영수증 링크 클릭 시 동작 확인 |
| **Expected Result** | GET /api/my/payments API 호출<br>테이블에 데이터 표시<br>필터 적용 시 데이터 업데이트 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC3-003 | /my/scores 성적 조회 및 그래프
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC3-003 |
| **Title** | Scores page displays test results and trend graph |
| **Precondition** | Parent 로그인, `/my/scores` 접근 |
| **Steps** | 1. 성적 리스트 로드<br>2. Recharts 그래프 렌더링 확인<br>3. 그래프 호버 시 tooltip 표시<br>4. 각 성적 카드의 상세 정보 확인 |
| **Expected Result** | GET /api/my/scores API 호출<br>리스트와 그래프 동시 표시<br>그래프 상호작용 정상 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC3-004 | /my/timetable 시간표 조회
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC3-004 |
| **Title** | Timetable page displays weekly schedule with navigation |
| **Precondition** | Parent 로그인, `/my/timetable` 접근 |
| **Steps** | 1. 현재 주간 시간표 로드<br>2. 각 셀에 클래스 정보 확인<br>3. "이전주" 버튼 클릭 후 시간표 업데이트<br>4. "다음주" 버튼 클릭 후 시간표 업데이트 |
| **Expected Result** | GET /api/my/timetable?week={week} API 호출<br>grid 레이아웃에 시간표 표시<br>주 선택 네비게이션 정상 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

---

### AC-4 | Portal 페이지 (Portal Pages)
**관련 Requirements**: FR-04

#### TC-AC4-001 | Home page 로드 및 콘텐츠
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC4-001 |
| **Title** | Home page displays hero, programs, and news sections |
| **Precondition** | 앱 시작, `/` 접근 |
| **Steps** | 1. 페이지 로드<br>2. Hero banner 이미지 로드 확인<br>3. 제목/설명 텍스트 표시<br>4. "상담신청" CTA 버튼 클릭<br>5. 프로그램 showcase 카드 3개 이상 표시<br>6. 최근 뉴스 3개 카드 표시<br>7. "더보기" 링크 클릭 |
| **Expected Result** | 모든 섹션 렌더링<br>CTA 버튼 → `/web/contact`<br>프로그램 카드 → `/programs/[id]`<br>"더보기" → `/news` |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | E2E / Smoke |
| **Priority** | P0 |

#### TC-AC4-002 | About page 로드 및 구성
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC4-002 |
| **Title** | About page displays mission, teachers, and facilities |
| **Precondition** | `/about` 접근 |
| **Steps** | 1. 페이지 로드<br>2. 미션/비전 섹션 텍스트 확인<br>3. 강사진 카드 3개 이상 표시<br>4. 각 강사 카드의 사진, 이름, 약력 확인<br>5. 시설 갤러리 이미지 로드 확인 |
| **Expected Result** | 모든 섹션 및 콘텐츠 표시 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Smoke |
| **Priority** | P1 |

#### TC-AC4-003 | Programs 리스트 및 필터
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC4-003 |
| **Title** | Programs page displays list with filtering and detail navigation |
| **Precondition** | `/programs` 접근 |
| **Steps** | 1. 프로그램 리스트 로드<br>2. 각 카드에 프로그램명, 설명, 대상학년 표시<br>3. 학년별 필터 적용<br>4. 카드 클릭 → `/programs/[id]` 이동 |
| **Expected Result** | GET /api/programs API 호출<br>그리드/리스트 레이아웃 표시<br>필터 적용 시 리스트 업데이트 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC4-004 | Program 상세 페이지
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC4-004 |
| **Title** | Program detail page displays curriculum and classes |
| **Precondition** | `/programs/[id]` (예: /programs/1) 접근 |
| **Steps** | 1. 프로그램 상세 로드<br>2. 커리큘럼 설명 표시<br>3. 개설 클래스 테이블: 시간, 강사, 정원, 상태<br>4. "상담신청" CTA 클릭 |
| **Expected Result** | GET /api/programs/[id] API 호출<br>상세 정보 및 클래스 테이블 표시<br>CTA → `/web/contact` |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC4-005 | News 리스트 및 페이지네이션
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC4-005 |
| **Title** | News page displays list with pagination |
| **Precondition** | `/news` 접근 |
| **Steps** | 1. 뉴스 리스트 로드 (10개 이상)<br>2. 각 카드: 썸네일, 제목, 요약, 작성일 확인<br>3. 페이지네이션 버튼 동작<br>4. 카드 클릭 → `/news/[slug]` |
| **Expected Result** | GET /api/posts API 호출<br>리스트 렌더링<br>페이지네이션 정상 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC4-006 | News 상세 페이지
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC4-006 |
| **Title** | News detail page displays full content with navigation |
| **Precondition** | `/news/[slug]` (예: /news/test-slug) 접근 |
| **Steps** | 1. 뉴스 상세 로드<br>2. 제목, 작성일, 카테고리 표시<br>3. 본문 HTML 렌더링 (이미지 포함 확인)<br>4. 이전/다음 뉴스 네비게이션 버튼 확인<br>5. 뉴스 목록으로 돌아가기 링크 |
| **Expected Result** | GET /api/posts/[id] API 호출<br>본문 정상 렌더링<br>네비게이션 링크 정상 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

---

### AC-5 | 신청 폼 (Public Forms)
**관련 Requirements**: FR-05

#### TC-AC5-001 | 상담신청 폼 제출
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC5-001 |
| **Title** | Contact form submission succeeds with valid data |
| **Precondition** | `/web/contact` 접근 |
| **Steps** | 1. 필수 필드 입력: 학부모이름, 학생이름, 연락처<br>2. 신청항목(5종) 선택<br>3. 학년, 메모(선택) 입력<br>4. Submit 버튼 클릭<br>5. 성공 메시지 표시 확인 |
| **Expected Result** | POST /api/web/contact API 호출<br>{ status: "success", message: "상담 신청이 접수되었습니다" }<br>성공 모달 표시 3초 후 자동 닫힘 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | E2E |
| **Priority** | P1 |

#### TC-AC5-002 | 상담신청 폼 검증 - 필수 필드 누락
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC5-002 |
| **Title** | Contact form validation - required fields |
| **Precondition** | `/web/contact` 접근 |
| **Steps** | 1. 학부모이름 비워둔 상태<br>2. Submit 버튼 클릭<br>3. 에러 메시지 확인 |
| **Expected Result** | Frontend validation: "학부모이름을 입력하세요"<br>Submit 버튼 비활성화 또는 400 에러 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC5-003 | 테스트신청 폼 제출
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC5-003 |
| **Title** | Test application form submission succeeds |
| **Precondition** | `/web/test` 접근 |
| **Steps** | 1. 필수 필드 입력<br>2. 신청테스트 선택 (여러 선택 가능)<br>3. Submit 버튼 클릭<br>4. 성공 메시지 확인 |
| **Expected Result** | POST /api/web/test API 호출<br>성공 메시지 표시 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | E2E |
| **Priority** | P1 |

---

### AC-6 | 인증 흐름 (Authentication Flow)
**관련 Requirements**: FR-06

#### TC-AC6-001 | Admin 로그인 동작 (기존)
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC6-001 |
| **Title** | Admin login flow works with admin credentials |
| **Precondition** | localStorage 비움, `/login` 접근 |
| **Steps** | 1. Admin 이메일 입력: "admin@tpi.co.kr"<br>2. 비밀번호 입력: "acm20261234"<br>3. Login 버튼 클릭<br>4. `/admin/dashboard` 리다이렉트 확인<br>5. Zustand store: user.role = "admin" 확인 |
| **Expected Result** | POST /api/acm/auth/login → 200<br>AccessToken 발급<br>`/admin/dashboard` 리다이렉트 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | E2E |
| **Priority** | P0 |

#### TC-AC6-002 | Admin / Parent 로그인 전환
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC6-002 |
| **Title** | Switching between admin and parent login |
| **Precondition** | Admin 로그인 완료 |
| **Steps** | 1. Admin 상태: Zustand user.role = "admin"<br>2. 로그아웃<br>3. `/login/parent` 접근<br>4. Parent OTP 로그인 진행<br>5. 완료 후 Zustand user.role = "parent" 확인 |
| **Expected Result** | 로그아웃 시 store 초기화<br>새 로그인 후 role 업데이트<br>localStorage 토큰 교체 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC6-003 | Admin 토큰 만료 후 재로그인
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC6-003 |
| **Title** | Admin token expiry triggers login redirect |
| **Precondition** | Admin 로그인 완료, `/admin/dashboard` 표시 중 |
| **Steps** | 1. Token 만료 시뮬레이션 (localStorage에서 token 제거)<br>2. 데이터 새로고침 또는 API 요청 (401 응답)<br>3. `/login?returnTo=/admin/dashboard` 리다이렉트 확인 |
| **Expected Result** | 401 응답 → `/login?returnTo=/admin/dashboard`<br>로그인 후 원래 페이지로 복귀 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

#### TC-AC6-004 | Parent 토큰 만료 후 재로그인
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC6-004 |
| **Title** | Parent token expiry triggers parent login redirect |
| **Precondition** | Parent 로그인 완료, `/my` 표시 중 |
| **Steps** | 1. Token 만료 시뮬레이션<br>2. API 요청 (401 응답)<br>3. `/login/parent?returnTo=/my` 리다이렉트 확인 |
| **Expected Result** | 401 응답 → `/login/parent?returnTo=/my` |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Integration |
| **Priority** | P1 |

---

### AC-7 | Responsive Design
**관련 Requirements**: NFR-02

#### TC-AC7-001 | Mobile (< 640px) Responsive
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC7-001 |
| **Title** | Pages display correctly on mobile (< 640px) |
| **Precondition** | DevTools 모바일 에뮬레이션: iPhone SE (375px) |
| **Steps** | 1. `/` 로드<br>2. Hero 섹션: full-width, 텍스트 가독성 확인<br>3. 프로그램 카드: 1열 스택<br>4. 네비게이션: 햄버거 메뉴 표시<br>5. `/admin/csl` 테이블: horizontal scroll 또는 card 뷰 |
| **Expected Result** | 모든 요소가 viewport 안에 맞음<br>텍스트 가독성 유지<br>터치 타겟 최소 44x44px |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Smoke |
| **Priority** | P1 |

#### TC-AC7-002 | Tablet (768px) Responsive
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC7-002 |
| **Title** | Pages display correctly on tablet (768px) |
| **Precondition** | DevTools 태블릿 에뮬레이션: iPad (768px) |
| **Steps** | 1. 프로그램 카드: 2열 그리드<br>2. 테이블: 컬럼 감추기 또는 스크롤<br>3. 네비게이션: 풀 메뉴 표시<br>4. 여백 및 padding 확인 |
| **Expected Result** | 2열 레이아웃 정상 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Smoke |
| **Priority** | P2 |

#### TC-AC7-003 | Desktop (1024px+) Responsive
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC7-003 |
| **Title** | Pages display correctly on desktop (1024px+) |
| **Precondition** | 데스크톱 뷰 (1920px) |
| **Steps** | 1. 프로그램 카드: 3열 이상 그리드<br>2. 사이드바/네비게이션 정렬<br>3. 여백 및 레이아웃 최적 |
| **Expected Result** | 3열 이상 그리드 표시<br>공간 활용 최적화 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Smoke |
| **Priority** | P2 |

---

### AC-8 | i18n (Internationalization)
**관련 Requirements**: NFR-02

#### TC-AC8-001 | 4개 언어 렌더링 (Home page)
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC8-001 |
| **Title** | Home page renders correctly in all 4 languages |
| **Precondition** | `/` 로드 |
| **Steps** | 1. Language switcher (또는 localStorage `i18nextLng` 변경):<br>- Ko (한국어): "상담신청" 표시<br>- En (English): "Request Consultation" 표시<br>- Vi (Tiếng Việt): "Yêu cầu tư vấn" 표시<br>- Zh-CN (中文): "申请咨询" 표시<br>2. 각 언어별 페이지 새로고침 |
| **Expected Result** | 4개 언어 모두 정상 렌더링<br>텍스트 깨짐(mojibake) 없음<br>레이아웃 유지 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Smoke |
| **Priority** | P1 |

#### TC-AC8-002 | i18n 키 누락 검사
| 항목 | 내용 |
|------|------|
| **ID** | TC-AC8-002 |
| **Title** | No untranslated keys (i18n::... strings) visible |
| **Precondition** | 모든 페이지 로드 |
| **Steps** | 1. DevTools 콘솔에 특수 문자 "i18n::" 검색<br>2. 화면에 "portal.hero_title" 같은 키 노출 여부<br>3. 각 페이지 검사: home, about, programs, news, my/*, admin/* |
| **Expected Result** | "i18n::" 패턴의 키 노출 없음<br>모든 텍스트가 번역된 상태 |
| **Actual Result** | — |
| **Status** | Not Run |
| **Category** | Unit |
| **Priority** | P1 |

---

## 3. 회귀 테스트 (Regression Tests)

### RT-01 | Admin 기존 기능 회귀
**범위**: `/admin/csl`, `/admin/cls`, `/admin/std`, `/admin/tch` (Phase 1 이전 기존 기능)

| Test | Expected | Status |
|------|----------|--------|
| Admin 로그인 기능 정상 | ✓ | Not Run |
| `/admin/csl` 리스트 표시 | ✓ | Not Run |
| `/admin/csl/[id]` 상세 표시 | ✓ | Not Run |
| `/admin/cls`, `/admin/std`, `/admin/tch` 각각 로드 | ✓ | Not Run |
| 각 페이지의 CRUD 동작 | ✓ | Not Run |
| i18n (4개 언어) | ✓ | Not Run |

### RT-02 | Web 공개 폼 회귀
**범위**: `/web/contact`, `/web/test`

| Test | Expected | Status |
|------|----------|--------|
| 폼 렌더링 | ✓ | Not Run |
| 폼 제출 성공 | ✓ | Not Run |
| 검증 에러 처리 | ✓ | Not Run |
| i18n 렌더링 | ✓ | Not Run |

---

## 4. Smoke Test (Staging 배포 후)

### S-01 | 경로 접근성
- [ ] `https://acm-stg.amoeba.site/` → 200
- [ ] `https://acm-stg.amoeba.site/admin` → 200 (또는 /login redirect)
- [ ] `https://acm-stg.amoeba.site/login/parent` → 200
- [ ] `https://acm-stg.amoeba.site/web/contact` → 200
- [ ] `https://acm-stg.amoeba.site/my` → 200 (또는 /login/parent redirect)

### S-02 | 인증 플로우
- [ ] Admin 로그인 성공
- [ ] Parent OTP 로그인 성공
- [ ] 로그아웃 후 private 경로 접근 불가

### S-03 | 핵심 데이터 로드
- [ ] Home 페이지 프로그램 카드 표시
- [ ] Parent 마이페이지 자녀 목록 표시
- [ ] Admin 콘솔 CSL 리스트 표시

### S-04 | i18n
- [ ] 4개 언어 전환 정상
- [ ] 텍스트 깨짐 없음

---

## 5. 테스트 실행 계획 (Execution Plan)

### Phase 1 테스트 (Week 1 말)
- TC-AC1-001 ~ TC-AC1-003 (라우팅)
- TC-AC2-001 ~ TC-AC2-002 (Parent 로그인 기본)
- RT-01 (Admin 회귀)

### Phase 2 테스트 (Week 2-3 말)
- TC-AC3-001 ~ TC-AC4-006 (마이페이지, Portal 페이지)
- TC-AC5-001 ~ TC-AC5-003 (폼)
- TC-AC7-001 ~ TC-AC8-002 (Responsive, i18n)
- RT-02 (Web 폼 회귀)

### Phase 3 테스트 (Week 4)
- S-01 ~ S-04 (Smoke tests on staging)

---

## 6. 테스트 환경

| 항목 | 구성 |
|------|------|
| **Browser** | Chrome/Safari latest 2 versions |
| **Devices** | iPhone SE (375px), iPad (768px), Desktop (1920px) |
| **Backend** | Staging API 또는 mock |
| **i18n** | Ko, En, Vi, Zh-CN |

---

## 7. 테스트 데이터 (Mock)

### Admin 계정
```
Email: admin@tpi.co.kr
Password: acm20261234
Role: admin
```

### Parent 계정
```
Email: parent@example.com
OTP: 123456 (mock)
Role: parent
```

### Mock API 응답
- `GET /api/programs` → 3개 프로그램 카드
- `GET /api/posts` → 5개 뉴스 항목
- `GET /api/my/payments` → 10개 결제 이력
- `GET /api/my/scores` → 3개 성적 기록
- `GET /api/my/timetable` → 주간 5개 클래스

---

## 8. 문제 추적 및 결과

### 발견된 이슈 Template
```
| Issue ID | Title | Severity | Status | Notes |
|----------|-------|----------|--------|-------|
| ISS-001 | ... | P0/P1/P2 | Open/Fixed | ... |
```

---

## 9. 다음 단계 (Next Steps)

1. **Phase 1 개발 진행** — T1-01 ~ T1-07 수행
2. **Phase 1 테스트 실행** — TC-AC1, TC-AC2 일부, RT-01
3. **결과 피드백** — 이슈 해결 후 Phase 2 진행
4. **최종 Smoke Test** — Staging 배포 후 S-01 ~ S-04

