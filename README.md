# 5등급제 입결 검색

5등급제 내신 등급을 입력하면 **환산 9등급 성적**으로 바꾸고, 2026학년도 입결(70% cut)이 그 근처인 모집단위를 보여주는 상담용 웹앱. 엑셀 `5등급.xlsx`의 `결과시트` 동작을 재현하고 범위 조절·필터·정렬을 더했다.

- 배포: https://specialzoker.github.io/grade5/
- 허브: https://specialzoker.github.io/sujifather/

## 동작

1. 5등급제 등급(1.00~5.00) 입력 → 변환표(395쌍)에서 **입력 이하의 가장 큰 값**에 대응하는 9등급 값(엑셀 VLOOKUP 근사 매칭).
2. 환산값 − 아래폭 **초과** ~ 환산값 + 위폭 **미만**의 70% cut을 가진 모집단위(기본 폭 0.1, 양끝 미포함 — 엑셀 수식 재현).
3. 지역(복수)·전형·계열 필터, 헤더 클릭 정렬(기본 대학명순).

검증: 입력 1.1 → 환산 1.39 → 1.29~1.49 → 엑셀 결과시트 259행과 집합 일치(`test/`).

## 접근 게이트

앱은 **학교 코드** 또는 **등록 이메일**을 입력해야 열린다. 한 번 통과한 브라우저는 `localStorage['grade5_access']`에 기억돼 다음부터 바로 열린다.

- 학교 코드 = 학교 홈페이지 도메인(예 `gaun-h.goegn.kr`). 입력은 소문자·`https://`·경로·앞 `www.` 제거 후 비교하므로 `https://www.gaun-h.goegn.kr/gaun-h/main.do`도 통과.
- 학교 목록 원본: `5등급학교.xlsx` 102교. 홈페이지는 웹 조사(`data/schools.json`). 경기도 학교 대부분이 `*.hs.kr`에서 교육지원청 도메인 `*-h.goeXX.kr`로 이전돼 있어 현행 주소를 기준으로 했다.
- 관리자: 우하단 ⚙ → 비밀번호(허브·통합검색기와 같은 `localStorage['snavi_pw']`, 기본 `xhd1212`) → 학교(추가·수정·삭제·일괄 등록)·이메일·입장 기록·설정(비밀번호 변경, 모든 기억 초기화).
- 저장: Firebase Firestore 프로젝트 `search-alluniv`(허브와 공유). 컬렉션 `grade5_schools`, `grade5_emails`, `grade5_logs`, `grade5_meta/gate`(기억 버전). 규칙은 클라이언트 자유 읽기/쓰기(소프트 게이트 — 코드를 아는 사람은 누구나 통과).
- "모든 기억 초기화"는 `grade5_meta/gate.version`을 올려 모든 브라우저가 코드를 다시 입력하게 한다.

## 구조

빌드 없음. `index.html` + `src/app.js`(검색 화면) + `src/engine.js`(순수 함수) + `src/gate.js`(게이트) + `src/admin.js`(관리자) + `src/firebase.js` + `data/*.json`.

## 데이터 갱신

```bash
PYTHONIOENCODING=utf-8 python scripts/extract.py "C:\경로\5등급.xlsx"
```
→ `data/ipgyeol.json`, `data/conv.json`, `test-data/golden.json`. 엑셀 구조가 바뀌면 스크립트의 assert가 멈춘다.

## 테스트

node는 이 PC의 PATH에 없다.
```bash
export PATH="/c/Users/user/AppData/Local/OpenAI/Codex/runtimes/cua_node/<hash>/bin:$PATH"
node --test test/engine.test.js
```

## 로컬 실행

```bash
python -m http.server 5180
```
→ http://localhost:5180/ (ES 모듈·fetch 때문에 file:// 로는 열리지 않음)

## 배포

GitHub Pages, Settings → Pages → Source = **Deploy from a branch**, `main` / `/ (root)`.
