# 5등급제 입결 검색

5등급제 내신 등급을 입력하면 **환산 9등급 성적**으로 바꾸고, 2026학년도 입결(70% cut)이 그 근처인 모집단위를 보여주는 상담용 웹앱. 엑셀 `5등급.xlsx`의 `결과시트` 동작을 재현하고 범위 조절·필터·정렬을 더했다.

- 배포: https://specialzoker.github.io/grade5/
- 허브: https://specialzoker.github.io/sujifather/

## 동작

1. 5등급제 등급(1.00~5.00) 입력 → 변환표(395쌍)에서 **입력 이하의 가장 큰 값**에 대응하는 9등급 값(엑셀 VLOOKUP 근사 매칭).
2. 환산값 − 아래폭 **초과** ~ 환산값 + 위폭 **미만**의 70% cut을 가진 모집단위(기본 폭 0.1, 양끝 미포함 — 엑셀 수식 재현).
3. 지역(복수)·전형·계열 필터, 헤더 클릭 정렬(기본 대학명순).

검증: 입력 1.1 → 환산 1.39 → 1.29~1.49 → 엑셀 결과시트 259행과 집합 일치(`test/`).

## 구조

빌드 없음. `index.html` + `src/engine.js`(순수 함수) + `data/*.json`.

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
