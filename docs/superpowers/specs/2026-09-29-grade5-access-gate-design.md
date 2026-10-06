# 5등급제 입결 검색 — 학교 코드 접근 게이트 설계

작성 2026-09-29. 대상 앱: `C:\Users\user\Documents\claude\grade5` (https://specialzoker.github.io/grade5/).

## 목적

앱을 아무나 열지 못하게 하고, **학교별 코드**(학교 홈페이지 주소) 또는 **등록된 이메일**로만 입장하게 한다. 한 번 입장한 컴퓨터(브라우저)는 다음부터 바로 열린다. 관리자 페이지에서 학교·코드·이메일을 관리한다.

학교 목록 출처: `C:\Users\user\Desktop\5등급학교.xlsx` 시트 `raw2_기초통계` E열(학교명 102개)·F열(지원청). 홈페이지 주소는 파일에 없어 웹에서 조사한다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 저장소 | Firebase Firestore, 허브와 같은 프로젝트 `search-alluniv` (compat SDK 10.12.0, 허브 index.html의 `firebaseConfig` 재사용) |
| 코드 | 홈페이지 전체 주소의 도메인(예 `www.gaun.hs.kr`). 입력은 정규화 후 비교 |
| 이메일 명단 | 이 앱 전용 소수 명단 `grade5_emails`. 허브 `allowed_emails`와 무관 |
| 기억 | `localStorage['grade5_access']`. 브라우저 단위 |
| 관리자 | ⚙ 버튼 → 클라이언트 비밀번호(허브와 같은 `localStorage['snavi_pw']`, 기본 `xhd1212`) |
| 접속 신청 | 없음 |
| 게이트 성격 | 소프트 게이트(허브와 동일). 코드를 아는 사람은 누구나 통과 |

## 데이터 (Firestore)

`grade5_schools` — 문서 ID 자동. 필드:
```json
{ "name": "가운고등학교", "office": "구리남양주", "homepage": "https://www.gaun.hs.kr", "code": "gaun.hs.kr" }
```
- `code`는 **정규화된 도메인**(아래 규칙). 조회는 `where('code','==',정규화(입력))`.
- 초기 102건은 **관리자 패널의 '일괄 등록' 버튼**이 `data/schools.json`을 읽어 batch write로 넣는다(서버 자격증명 불필요).

`grade5_meta/gate` — 문서 1개. `{ "version": 1 }`. 관리자의 "모든 기억 초기화"가 +1 한다.

`grade5_emails` — 문서 ID = 소문자 이메일. 필드 `{ "name": "" , "addedAt": serverTimestamp }`.

`grade5_logs` — 자동 ID. `{ "type": "school"|"email", "who": "가운고등학교"|"a@b.c", "at": serverTimestamp, "ua": navigator.userAgent 앞 80자 }`.

**보안 규칙**(Firebase 콘솔에서 추가):
```
match /grade5_schools/{doc} { allow read, write: if true; }
match /grade5_emails/{doc}  { allow read, write: if true; }
match /grade5_logs/{doc}    { allow read, create: if true; }
match /grade5_meta/{doc}    { allow read, write: if true; }
```
허브의 기존 컬렉션 규칙과 같은 수준(클라이언트 자유 읽기/쓰기).

## 코드 정규화 규칙 (`src/gate.js`의 `normalizeCode`)

1. 앞뒤 공백 제거, 소문자.
2. `http://`, `https://` 제거.
3. 첫 `/` 이후 제거(경로·쿼리 버림).
4. 앞의 `www.` 제거.
5. 빈 문자열이면 null.

예: `https://www.Gaun.hs.kr/main.do` → `gaun.hs.kr`. `gaun.hs.kr` → `gaun.hs.kr`. 저장된 `code`도 같은 규칙으로 정규화해 저장한다.

## 화면

### 게이트 (index.html, 앱 위를 덮는 오버레이)
- 로고(경기진협)와 제목, 설명 한 줄: "학교 홈페이지 주소(코드) 또는 등록된 이메일을 입력하세요."
- 입력 1개 + "입장" 버튼. 입력값에 `@`가 있으면 이메일, 아니면 학교 코드로 판단.
- 성공: `localStorage['grade5_access'] = {type, who, at}` 저장, `grade5_logs`에 기록, 오버레이 제거, 우상단 배지 옆에 "가운고등학교 · 나가기" 표시. "나가기"는 localStorage 삭제 후 오버레이 복귀.
- 실패: "등록되지 않은 코드/이메일입니다. 학교 홈페이지 주소를 확인하세요." (빨간 글씨)
- Firestore 오류(네트워크 등): "확인 중 오류가 났습니다. 잠시 후 다시 시도하세요."
- 페이지 로드 시 `grade5_access`가 있으면 오버레이 없이 바로 앱 표시(재검증 없음 — 명단에서 빠져도 이미 기억된 브라우저는 통과. 관리자가 막고 싶으면 '기억 무효화' 필요하므로 아래 참조).
- **기억 무효화:** `grade5_schools`/`grade5_emails`와 별개로 `grade5_meta/gate` 문서의 `version`(정수)을 두고, 저장된 access의 `v`와 다르면 다시 입력하게 한다. 관리자 패널에 "모든 기억 초기화" 버튼 = version + 1. 로드 시 version 조회는 한 번(실패하면 기억을 그대로 신뢰).

### 관리자 패널 (⚙ 버튼, 우상단)
- 비밀번호 프롬프트(허브와 동일 로직·저장키). 통과하면 모달.
- 탭 **학교**: 표(학교명·지원청·홈페이지·코드) + 행별 "수정"(인라인 편집 후 저장)·"삭제" + 상단 "학교 추가" 폼(학교명·지원청·홈페이지; 코드는 홈페이지에서 자동 정규화) + "data/schools.json 일괄 등록"(비어 있을 때 초기 적재용; 이미 있는 학교명은 건너뜀).
- 탭 **이메일**: 목록 + 추가(이메일·이름)·삭제.
- 탭 **입장 기록**: 최근 200건(시각·유형·who).
- 하단: 비밀번호 변경, "모든 기억 초기화".

## 파일 구조

| 파일 | 책임 |
|---|---|
| `index.html` | 기존 앱 + 게이트 오버레이 + 관리자 모달 마크업/스타일. 스크립트는 `src/app.js`(기존 인라인 이동), `src/gate.js`, `src/admin.js` 임포트 |
| `src/gate.js` | `normalizeCode`, `isEmail`, `checkAccess(db, input)`, `loadAccess()/saveAccess()/clearAccess()` |
| `src/admin.js` | 관리자 모달 로직(허브 index.html의 관리자 코드 패턴 이식) |
| `src/firebase.js` | firebaseConfig + `db` export (compat SDK는 `<script>`로 로드, `window.firebase` 사용) |
| `data/schools.json` | 조사한 102교 `{name, office, homepage}` |
| `scripts/research_schools.md` | 조사 방법·미확인 학교 메모 |
| `test/gate.test.js` | `normalizeCode`, `isEmail` 단위 테스트 |

## 홈페이지 조사

- 102교(경기도, 모두 고등학교). 검색으로 공식 홈페이지 도메인을 찾아 `data/schools.json`에 기록. 경기도 학교는 대개 `*.hs.kr` 또는 `*.goe.go.kr`.
- 찾지 못한 학교는 `homepage: ""`로 두고 조사 메모에 남긴다. 그런 학교는 관리자가 패널에서 채우기 전까지 코드로 입장 불가.
- 사용자 검토용으로 표를 채팅에 보여준다.

## 검증

- `node --test test/gate.test.js`: 정규화 예시 6개, 이메일 판별.
- 브라우저(로컬 서버 + 실제 Firestore): 코드 입장 → 새로고침 시 바로 열림 → 나가기 → 오버레이 복귀. 잘못된 코드 실패 메시지. 이메일 입장. 관리자: 학교 추가·수정·삭제, 이메일 추가·삭제, 기억 초기화 후 재입력 요구.
- 배포 후 실제 주소에서 코드 입장 1회 확인.

## 범위 외

- 접속 신청/승인 흐름, 본인 확인, 서버측 규칙 강화, 허브 명단 연동.

## 추가(2026-10-06): 학교 모의고사 코드

- 입력이 **숫자 5자리**면 모의고사 코드로 판단해 `grade5_schools`에서 `examCodes array-contains 입력`으로 조회한다. 홈페이지 코드·이메일 판별보다 먼저 검사한다.
- `grade5_schools` 문서에 `examCodes: string[]` 추가. 배열인 이유: 설문 응답에서 한 학교가 서로 다른 코드 두 개를 낸 경우(초월고 17872/17892, 경기관광고 17710/17719)가 있어 확인 전까지 둘 다 허용한다.
- 관리자 학교 탭에 "모의고사 코드" 열(쉼표 구분 입력, `parseExamCodes`로 5자리 숫자만 저장) 추가.
- 출처: `협력교 모의고사 코드 취합(응답)` CSV(116행). 학교명 정리: 공백 제거, `동국대부속영석고`→동국대학교사범대학부속영석고등학교, `풍산고등학교`→하남풍산고등학교, `안산 양지고등학교`→양지고등학교. `조성진`(응답자 이름, 코드는 풍덕고와 동일) 행은 제외.
- 102교 중 99교 매칭. 코드 미제출 3교: 수리고·오남고·이산고. 102교 목록에 없는 응답 7교(청담·죽산·저현·양지·경기관광·가평·판교고)는 홈페이지 없이 모의고사 코드만으로 입장되도록 새 학교로 추가한다.
- 로컬 `data/exam_codes.json`(gitignore)은 매핑 산출물. 적용은 로컬 미리보기 페이지에서 Firestore batch update로 1회 수행.
