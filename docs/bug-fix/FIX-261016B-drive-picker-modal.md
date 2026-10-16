---
document_id: ACM-FIX-261016B-DRIVE-PICKER
version: 1.0.0
status: Fixed (staging), production verification pending
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Google Picker unusable over ACM modal; add My Drive tab / 모달 위 Google Picker 조작 불가 수정
---
# Google Picker over Modal Fix (모달 위 Google Picker 동작 불가 수정)

## 1. Symptom (증상)
`/admin/config/drive` → [폴더 연결] → "공용 폴더 · 공유 대상" 대화상자에서 [Google 폴더 선택]을 누르면 Google Picker는 뜨지만 클릭·선택이 되지 않는다. 또 "Shared drives" 탭만 보이고 내 드라이브가 없다.

## 2. Cause (원인)
- ACM 대화상자(Radix Dialog, modal)는 열려 있는 동안 `body`에 `pointer-events: none`을 걸고 포커스를 대화상자 안에 가둔다(FocusScope). 대화상자 바깥을 누르면 닫히는 동작(DismissableLayer)도 있다.
- Google Picker는 `body`에 직접 붙는 별도 요소/iframe이라 이 제약을 그대로 받는다. 그래서 포인터 이벤트가 막히고, iframe으로 간 포커스도 대화상자로 되돌려진다.
- Picker 뷰가 `setEnableDrives(true)` 하나뿐이어서 공유 드라이브만 표시됐다.

## 3. Fix (수정) — `frontend-acm/src/modules/prj/google-picker.ts`
- Picker가 열려 있는 동안만 다음을 적용한다.
  - Picker 요소에 `pointer-events:auto`와 최상위 z-index를 준다.
  - Picker를 대상(또는 relatedTarget)으로 하는 `focusin`·`focusout`·`pointerdown`·`mousedown`·`touchstart`를 window 캡처 단계에서 끊는다. 그래서 대화상자의 포커스 트랩과 바깥 클릭 닫기가 반응하지 않는다.
- Picker가 닫히면(선택·취소) 위 처리를 해제한다.
- 뷰를 **내 드라이브**(`setParent('root')`)와 **공유 드라이브** 두 탭으로 나누고 `SUPPORT_DRIVES`를 켰다.
- 같은 함수를 쓰는 모든 위치에 적용된다: 설정 화면 공용폴더 선택, 드라이브 [폴더 연결], 프로젝트 [Drive 파일 연결].

## 4. Verification (검증)
- frontend-acm `tsc`·build 통과.
- 실제 Google Picker 조작은 운영 계정으로 확인해야 한다(로컬에는 OAuth 앱이 없다).
