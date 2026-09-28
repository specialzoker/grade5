# 5등급제 입결 검색 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5등급제 내신 등급을 입력하면 환산 9등급으로 바꿔 2026학년도 70% cut이 그 근처(기본 ±0.1, 양끝 미포함)인 모집단위를 필터·정렬해 보여주는 정적 웹앱.

**Architecture:** 빌드 없는 단일 `index.html`이 `src/engine.js`(순수 함수 ES 모듈)와 `data/*.json`(fetch)을 조합한다. 데이터는 `scripts/extract.py`가 엑셀에서 추출하고, 입력 1.1의 엑셀 결과 259행을 골든으로 `node --test`가 검증한다.

**Tech Stack:** HTML/CSS/vanilla JS(ES modules), Python 3.12 + openpyxl(추출만), Node 24 내장 `node:test`(테스트만). GitHub Pages(Deploy from branch).

**스펙:** `docs/superpowers/specs/2026-09-29-grade5-ipgyeol-search-design.md`

**환경 주의**
- 작업 폴더: `C:\Users\user\Documents\claude\grade5` (Git Bash 경로 `/c/Users/user/Documents/claude/grade5`). 모든 명령은 이 폴더에서.
- node/npm은 PATH에 없다. 먼저 해시 폴더를 확인하고 PATH에 넣는다(해시는 바뀔 수 있음):
  ```bash
  ls -d /c/Users/user/AppData/Local/OpenAI/Codex/runtimes/cua_node/*/bin
  export PATH="/c/Users/user/AppData/Local/OpenAI/Codex/runtimes/cua_node/ecfc0d9aa02807e3/bin:$PATH"
  ```
- Python 출력에 한글이 섞이면 `PYTHONIOENCODING=utf-8` 를 앞에 붙인다(cp949 인코딩 오류 방지).
- 원본 엑셀 `C:\Users\user\Desktop\5등급.xlsx`는 저장소에 넣지 않는다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `scripts/extract.py` | 엑셀 → `data/ipgyeol.json`, `data/conv.json`, `test-data/golden.json`. 자체 assert |
| `data/ipgyeol.json` | 입결 14,612행 (열 배열) |
| `data/conv.json` | 5→9등급 변환표 395쌍 |
| `test-data/golden.json` | 입력 1.1의 결과시트 259행 |
| `src/engine.js` | `convert`, `searchRange`, `search`, `applyFilters`, `sortRows` — DOM 무관 순수 함수 |
| `test/engine.test.js` | `node --test` 테스트 |
| `index.html` | 화면·스타일·UI 스크립트(engine.js 임포트) |
| `README.md` | 용도·실행·데이터 갱신·배포 |
| `.gitignore` | `__pycache__/` |

---

### Task 1: 데이터 추출 스크립트

**Files:**
- Create: `scripts/extract.py`
- Create: `.gitignore`
- Output: `data/ipgyeol.json`, `data/conv.json`, `test-data/golden.json`

- [ ] **Step 1: .gitignore 작성**

```
__pycache__/
*.xlsx
```

- [ ] **Step 2: extract.py 작성**

```python
"""5등급.xlsx → data/ipgyeol.json, data/conv.json, test-data/golden.json
사용: python scripts/extract.py [엑셀경로]
"""
import json, sys, os
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\user\Desktop\5등급.xlsx"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLUMNS = ["지역", "대학명", "전형", "전형명", "계열", "모집단위", "모집인원", "경쟁률", "충원순위", "cut70"]


def _cell(v):
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v


def _row(values):
    return [_cell(v) for v in values[:10]]


def dump(rel, obj):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{rel}: {os.path.getsize(path):,} bytes")


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)

    # 1) 입결
    ws = wb["2026학년도 입결"]
    it = ws.iter_rows(values_only=True)
    header = [_cell(v) for v in next(it)[:10]]
    assert header[0] == "지역" and header[9] == "70% cut", header
    rows = [_row(r) for r in it if r and r[0]]
    assert len(rows) == 14612, len(rows)
    assert all(isinstance(r[9], (int, float)) for r in rows), "cut70 must be numeric"
    dump("data/ipgyeol.json", {"source": "2026학년도 입결", "columns": COLUMNS, "rows": rows})

    # 2) 변환표 T2:U396 + 골든 결과 J3:S
    ws = wb["결과시트"]
    pairs, golden, inp, conv = [], [], None, None
    for i, r in enumerate(ws.iter_rows(values_only=True), 1):
        r = list(r) + [None] * (21 - len(r))
        if i == 1:
            inp = r[2]          # C1
        elif i == 2:
            conv = r[2]         # C2
        if i >= 2 and r[19] is not None:
            pairs.append([float(r[19]), float(r[20])])
        if i >= 3 and r[9]:
            golden.append(_row(r[9:19]))
    assert len(pairs) == 395, len(pairs)
    assert all(pairs[k][0] < pairs[k + 1][0] for k in range(len(pairs) - 1)), "5등급 키 오름차순 아님"
    assert all(pairs[k][1] <= pairs[k + 1][1] for k in range(len(pairs) - 1)), "9등급 값 비감소 아님"
    assert pairs[0][0] == 1 and pairs[-1][0] == 5
    dump("data/conv.json", {"source": "결과시트 T2:U396", "pairs": pairs})

    assert inp == 1.1 and conv == 1.39 and len(golden) == 259, (inp, conv, len(golden))
    lo, hi = round(conv - 0.1, 3), round(conv + 0.1, 3)
    dump("test-data/golden.json", {"input": inp, "converted": conv, "lo": lo, "hi": hi,
                                   "columns": COLUMNS, "rows": golden})


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 실행**

Run: `cd /c/Users/user/Documents/claude/grade5 && PYTHONIOENCODING=utf-8 python scripts/extract.py`
Expected:
```
data/ipgyeol.json: 1,0xx,xxx bytes
data/conv.json: 5,xxx bytes
test-data/golden.json: 2x,xxx bytes
```
(assert 하나라도 실패하면 스펙의 원본 분석과 다른 것이니 멈추고 보고.)

- [ ] **Step 4: 산출물 확인**

Run: `PYTHONIOENCODING=utf-8 python -c "import json;d=json.load(open('data/ipgyeol.json',encoding='utf-8'));print(len(d['rows']),d['rows'][0]);c=json.load(open('data/conv.json',encoding='utf-8'));print(len(c['pairs']),c['pairs'][:3])"`
Expected: `14612 ['경남', '가야대', '교과', '일반전형', '자연', '간호학과', 17, 11.41, 73, 3.13]` 와 `395 [[1, 1.24], [1.05, 1.25], [1.053, 1.33]]`

- [ ] **Step 5: 커밋**

```bash
git add .gitignore scripts/extract.py data/ test-data/
git commit -m "feat: 엑셀 → 입결·변환표·골든 JSON 추출 스크립트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: engine.js — convert, searchRange

**Files:**
- Create: `src/engine.js`
- Create: `test/engine.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`test/engine.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { convert, searchRange } from '../src/engine.js'

const conv = JSON.parse(readFileSync(new URL('../data/conv.json', import.meta.url), 'utf8'))
const PAIRS = conv.pairs

test('convert: 표에 있는 값', () => {
  assert.equal(convert(1.1, PAIRS), 1.39)
  assert.equal(convert(1, PAIRS), 1.24)
  assert.equal(convert(5, PAIRS), 8.97)
})

test('convert: 표에 없는 값은 이하의 최대 키 (VLOOKUP 근사)', () => {
  // 1.118 → 1.5, 1.15 → 1.51 이므로 1.12는 1.118의 값
  assert.equal(convert(1.12, PAIRS), 1.5)
  assert.equal(convert(4.99, PAIRS), 7.87) // 4.947의 값
})

test('convert: 범위 밖·비정상 입력은 null', () => {
  assert.equal(convert(0.99, PAIRS), null)
  assert.equal(convert(5.01, PAIRS), null)
  assert.equal(convert(NaN, PAIRS), null)
  assert.equal(convert(null, PAIRS), null)
})

test('searchRange: 부동소수 오차 없이 소수 셋째자리', () => {
  assert.deepEqual(searchRange(1.39, 0.1, 0.1), { lo: 1.29, hi: 1.49 })
  assert.deepEqual(searchRange(1.39, 0.2, 0.05), { lo: 1.19, hi: 1.44 })
  assert.deepEqual(searchRange(1.39, 0, 0), { lo: 1.39, hi: 1.39 })
})
```

- [ ] **Step 2: 실패 확인**

Run: `export PATH="/c/Users/user/AppData/Local/OpenAI/Codex/runtimes/cua_node/ecfc0d9aa02807e3/bin:$PATH" && node --test test/engine.test.js`
Expected: FAIL — `Cannot find module '.../src/engine.js'`

- [ ] **Step 3: 구현**

`src/engine.js`:
```js
// 순수 계산 함수. DOM을 모른다. index.html과 test/에서 임포트한다.

export const COL = {
  region: 0, univ: 1, type: 2, typeName: 3, track: 4, unit: 5,
  quota: 6, ratio: 7, waitlist: 8, cut70: 9,
}

/** 5등급제 등급 → 환산 9등급. pairs는 [g5, g9] 오름차순. 범위(1~5) 밖·NaN → null.
 *  엑셀 VLOOKUP 근사 매칭: g5 이하의 가장 큰 키의 값. */
export function convert(g5, pairs) {
  if (typeof g5 !== 'number' || Number.isNaN(g5)) return null
  if (g5 < pairs[0][0] || g5 > pairs[pairs.length - 1][0]) return null
  let lo = 0, hi = pairs.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (pairs[mid][0] <= g5) lo = mid
    else hi = mid - 1
  }
  return pairs[lo][1]
}

const r3 = (x) => Math.round(x * 1000) / 1000

/** 검색 범위. 1.39-0.1 = 1.2899999… 같은 부동소수 오차를 소수 셋째자리로 정리. */
export function searchRange(conv, down, up) {
  return { lo: r3(conv - down), hi: r3(conv + up) }
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/engine.test.js`
Expected: `# pass 4` `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat: 5등급→9등급 변환·검색범위 함수

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: engine.js — search + 골든 검증

**Files:**
- Modify: `src/engine.js`
- Modify: `test/engine.test.js`

- [ ] **Step 1: 실패 테스트 추가**

`test/engine.test.js` 상단 import에 `search` 추가:
```js
import { convert, searchRange, search } from '../src/engine.js'
```
파일 끝에 추가:
```js
const ipgyeol = JSON.parse(readFileSync(new URL('../data/ipgyeol.json', import.meta.url), 'utf8'))
const golden = JSON.parse(readFileSync(new URL('../test-data/golden.json', import.meta.url), 'utf8'))
const ROWS = ipgyeol.rows

test('search 골든: 입력 1.1 → 결과시트 259행과 집합 일치', () => {
  const c = convert(golden.input, PAIRS)
  assert.equal(c, golden.converted)
  const { lo, hi } = searchRange(c, 0.1, 0.1)
  assert.equal(lo, golden.lo)
  assert.equal(hi, golden.hi)
  const got = search(ROWS, lo, hi)
  assert.equal(got.length, 259)
  const key = (r) => r.slice(0, 6).join('|') + '|' + r[9]
  assert.deepEqual(new Set(got.map(key)), new Set(golden.rows.map(key)))
})

test('search: 양끝 미포함', () => {
  const got = search(ROWS, 1.29, 1.49)
  assert.ok(got.every((r) => r[9] > 1.29 && r[9] < 1.49))
  assert.ok(ROWS.some((r) => r[9] === 1.29), '데이터에 1.29 행이 있어야 경계 테스트가 의미 있음')
  assert.ok(ROWS.some((r) => r[9] === 1.49))
})

test('search: lo > hi 이거나 범위에 없으면 빈 배열', () => {
  assert.deepEqual(search(ROWS, 1.49, 1.29), [])
  assert.deepEqual(search(ROWS, 0.5, 0.9), [])
})
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/engine.test.js`
Expected: FAIL — `search is not a function` (또는 export 없음)

- [ ] **Step 3: 구현**

`src/engine.js` 끝에 추가:
```js
/** lo < cut70 < hi 인 행만 (양끝 미포함 — 엑셀 결과시트 재현). */
export function search(rows, lo, hi) {
  return rows.filter((r) => {
    const c = r[COL.cut70]
    return typeof c === 'number' && c > lo && c < hi
  })
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/engine.test.js`
Expected: `# pass 7` `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat: 범위 검색 함수 + 엑셀 결과시트 259행 골든 검증

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: engine.js — applyFilters, sortRows

**Files:**
- Modify: `src/engine.js`
- Modify: `test/engine.test.js`

- [ ] **Step 1: 실패 테스트 추가**

import에 `applyFilters, sortRows, COL` 추가:
```js
import { convert, searchRange, search, applyFilters, sortRows, COL } from '../src/engine.js'
```
파일 끝에 추가:
```js
const SAMPLE = [
  ['서울', '한양대', '종합', '고른기회', '자연', '학부A', 5, 20.2, 9, 1.49],
  ['경기', '가천대', '교과', '특성화고교', '자연', '기계공학부', 4, 15.25, 1, 1.38],
  ['강원', '강원대', '교과', '저소득전형', '자연', '약학과', 4, 8, 3, 1.45],
  ['경기', '경기대', '교과', '농어촌학생전형', '인문', '공공안전학부', 3, null, 5, 1.33],
]

test('applyFilters: 빈 조건은 전체', () => {
  assert.equal(applyFilters(SAMPLE, { regions: new Set(), type: '', track: '' }).length, 4)
})

test('applyFilters: 지역 복수 + 전형 + 계열', () => {
  const r = applyFilters(SAMPLE, { regions: new Set(['경기', '강원']), type: '교과', track: '자연' })
  assert.deepEqual(r.map((x) => x[COL.univ]), ['가천대', '강원대'])
})

test('sortRows: 문자열 오름차순(한글), 원본 배열 불변', () => {
  const s = sortRows(SAMPLE, COL.univ, 'asc')
  assert.deepEqual(s.map((x) => x[COL.univ]), ['가천대', '강원대', '경기대', '한양대'])
  assert.equal(SAMPLE[0][COL.univ], '한양대')
})

test('sortRows: 숫자 내림차순, null은 항상 마지막', () => {
  const s = sortRows(SAMPLE, COL.ratio, 'desc')
  assert.deepEqual(s.map((x) => x[COL.ratio]), [20.2, 15.25, 8, null])
  const a = sortRows(SAMPLE, COL.ratio, 'asc')
  assert.deepEqual(a.map((x) => x[COL.ratio]), [8, 15.25, 20.2, null])
})
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/engine.test.js`
Expected: FAIL — `applyFilters is not a function`

- [ ] **Step 3: 구현**

`src/engine.js` 끝에 추가:
```js
/** filters: { regions: Set<string>(빈 Set = 전체), type: ''|'교과'|'종합', track: ''|계열 } */
export function applyFilters(rows, { regions, type, track }) {
  return rows.filter((r) =>
    (regions.size === 0 || regions.has(r[COL.region])) &&
    (!type || r[COL.type] === type) &&
    (!track || r[COL.track] === track),
  )
}

const collator = new Intl.Collator('ko')

/** 새 배열 반환. null/undefined는 방향과 무관하게 항상 마지막. */
export function sortRows(rows, colIndex, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = a[colIndex], y = b[colIndex]
    const xn = x == null, yn = y == null
    if (xn || yn) return xn && yn ? 0 : xn ? 1 : -1
    if (typeof x === 'number' && typeof y === 'number') return sign * (x - y)
    return sign * collator.compare(String(x), String(y))
  })
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/engine.test.js`
Expected: `# pass 11` `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat: 지역·전형·계열 필터와 컬럼 정렬 함수

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: index.html — 화면

**Files:**
- Create: `index.html`
- Create: `.claude/launch.json`

- [ ] **Step 1: index.html 작성**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>5등급제 입결 검색</title>
<style>
  :root {
    --green:#24503a; --green-mid:#2f6b45; --green-soft:#3d7a54;
    --cream:#f5f6ee; --card:#fffdf7; --line:#e2e5d3;
    --ink:#24503a; --muted:#7a8a72; --text:#2b2f28;
    --shadow:0 1px 2px rgba(36,80,58,.08); --radius:10px;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--cream); color:var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size:14px; }
  .wrap { max-width:1400px; margin:0 auto; padding:20px 16px 40px; }
  header h1 { margin:0; color:var(--green); font-size:22px; }
  header p { margin:4px 0 0; color:var(--muted); }
  header .src { font-size:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); padding:14px 16px; margin-top:14px; }
  .inputs { display:flex; flex-wrap:wrap; gap:16px 28px; align-items:flex-end; }
  .field label { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }
  .field input { width:110px; padding:8px 10px; border:1px solid var(--line); border-radius:6px; font-size:16px; background:#fff; }
  .field input:focus { outline:2px solid var(--green-soft); border-color:transparent; }
  #g5 { background:#fff9c4; font-weight:600; }
  .conv { font-size:26px; font-weight:700; color:var(--green); min-width:90px; line-height:1.1; }
  .conv small { display:block; font-size:12px; font-weight:400; color:var(--muted); }
  .hint { margin-top:10px; color:var(--muted); }
  .hint b { color:var(--green); }
  .hint.warn { color:#a3462a; }
  .filters { display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { border:1px solid var(--line); background:#fff; border-radius:999px; padding:4px 11px; cursor:pointer; font-size:13px; color:var(--text); }
  .chip.on { background:var(--green); border-color:var(--green); color:#fff; }
  select { padding:6px 8px; border:1px solid var(--line); border-radius:6px; background:#fff; font-size:13px; }
  .count { margin-left:auto; color:var(--muted); }
  .count b { color:var(--green); font-size:16px; }
  .table-scroll { max-height:70vh; overflow:auto; border:1px solid var(--line); border-radius:8px; background:#fff; margin-top:12px; }
  table { border-collapse:separate; border-spacing:0; width:100%; min-width:900px; }
  th, td { padding:7px 10px; border-bottom:1px solid var(--line); white-space:nowrap; text-align:left; }
  th { position:sticky; top:0; background:var(--green); color:#fff; cursor:pointer; user-select:none; font-weight:600; }
  th:hover { background:var(--green-mid); }
  th .arrow { opacity:.5; font-size:11px; margin-left:4px; }
  th.sorted .arrow { opacity:1; }
  td.num { text-align:right; font-variant-numeric: tabular-nums; }
  td.cut { font-weight:700; color:var(--green); }
  tbody tr:hover { background:#f3f6ee; }
  .empty { padding:40px 16px; text-align:center; color:var(--muted); }
  @media (max-width: 600px) {
    .field input { width:90px; }
    .count { margin-left:0; width:100%; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>5등급제 입결 검색</h1>
    <p>5등급제 내신 → 환산 9등급 → 2026학년도 70% cut이 그 근처인 모집단위</p>
    <p class="src">출처: 2026학년도 입결(70% cut) · 5등급⇔9등급 변환표. 상담 참고용.</p>
  </header>

  <section class="card">
    <div class="inputs">
      <div class="field">
        <label for="g5">5등급제 등급 (1.00 ~ 5.00)</label>
        <input id="g5" type="number" min="1" max="5" step="0.01" placeholder="1.10" inputmode="decimal" />
      </div>
      <div class="conv"><span id="convVal">–</span><small>환산 9등급 성적</small></div>
      <div class="field">
        <label for="down">아래로 (등급)</label>
        <input id="down" type="number" min="0" step="0.01" value="0.1" inputmode="decimal" />
      </div>
      <div class="field">
        <label for="up">위로 (등급)</label>
        <input id="up" type="number" min="0" step="0.01" value="0.1" inputmode="decimal" />
      </div>
    </div>
    <div id="hint" class="hint">등급을 입력하세요.</div>
  </section>

  <section class="card">
    <div class="filters">
      <div class="chips" id="regionChips"></div>
      <select id="typeSel">
        <option value="">전형 전체</option><option>교과</option><option>종합</option>
      </select>
      <select id="trackSel">
        <option value="">계열 전체</option><option>인문</option><option>자연</option><option>공통</option><option>예체능</option>
      </select>
      <div class="count"><b id="count">0</b> 건</div>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr id="headRow"></tr></thead>
        <tbody id="body"></tbody>
      </table>
      <div id="empty" class="empty">데이터 로딩 중…</div>
    </div>
  </section>
</div>

<script type="module">
import { COL, convert, searchRange, search, applyFilters, sortRows } from './src/engine.js'

const HEADERS = ['지역', '대학명', '전형', '전형명', '계열', '모집단위', '모집인원', '경쟁률', '충원순위', '70% cut']
const NUM_COLS = new Set([COL.quota, COL.ratio, COL.waitlist, COL.cut70])
const $ = (id) => document.getElementById(id)

const state = {
  rows: [], pairs: [],
  regions: new Set(), type: '', track: '',
  sortCol: COL.univ, sortDir: 'asc',
}

// ---- 헤더 ----
HEADERS.forEach((h, i) => {
  const th = document.createElement('th')
  th.innerHTML = `${h}<span class="arrow">↕</span>`
  th.addEventListener('click', () => {
    if (state.sortCol === i) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'
    else { state.sortCol = i; state.sortDir = 'asc' }
    render()
  })
  $('headRow').appendChild(th)
})

// ---- 데이터 로드 ----
async function load() {
  const [ip, cv] = await Promise.all([
    fetch('./data/ipgyeol.json').then((r) => r.json()),
    fetch('./data/conv.json').then((r) => r.json()),
  ])
  state.rows = ip.rows
  state.pairs = cv.pairs
  const regions = [...new Set(ip.rows.map((r) => r[COL.region]))].sort((a, b) => a.localeCompare(b, 'ko'))
  for (const rg of regions) {
    const b = document.createElement('button')
    b.className = 'chip'; b.textContent = rg; b.type = 'button'
    b.addEventListener('click', () => {
      if (state.regions.has(rg)) state.regions.delete(rg); else state.regions.add(rg)
      b.classList.toggle('on', state.regions.has(rg))
      render()
    })
    $('regionChips').appendChild(b)
  }
  render()
}

// ---- 계산 + 렌더 ----
function num(id) { const v = parseFloat($(id).value); return Number.isNaN(v) ? null : v }

function render() {
  const g5 = num('g5')
  const down = num('down') ?? 0
  const up = num('up') ?? 0
  const head = [...$('headRow').children]
  head.forEach((th, i) => {
    th.classList.toggle('sorted', i === state.sortCol)
    th.querySelector('.arrow').textContent = i !== state.sortCol ? '↕' : state.sortDir === 'asc' ? '▲' : '▼'
  })

  const hint = $('hint')
  hint.className = 'hint'
  if (g5 == null) {
    $('convVal').textContent = '–'
    hint.textContent = '등급을 입력하세요.'
    return draw([], '등급을 입력하세요.')
  }
  const conv = convert(g5, state.pairs)
  if (conv == null) {
    $('convVal').textContent = '–'
    hint.className = 'hint warn'
    hint.textContent = '1.00 ~ 5.00 사이로 입력하세요.'
    return draw([], '1.00 ~ 5.00 사이로 입력하세요.')
  }
  $('convVal').textContent = conv.toFixed(2)
  const { lo, hi } = searchRange(conv, down, up)
  const inRange = search(state.rows, lo, hi)
  const filtered = applyFilters(inRange, state)
  hint.innerHTML = `검색 범위 70% cut <b>${lo.toFixed(2)} 초과 ~ ${hi.toFixed(2)} 미만</b> · 범위 내 <b>${inRange.length}</b>건`
  const empty = inRange.length === 0
    ? '범위 안에 모집단위가 없습니다. 위/아래 폭을 넓혀보세요.'
    : filtered.length === 0 ? '필터 조건에 맞는 결과가 없습니다.' : ''
  draw(sortRows(filtered, state.sortCol, state.sortDir), empty)
}

function draw(rows, emptyMsg) {
  $('count').textContent = rows.length.toLocaleString()
  $('empty').textContent = emptyMsg
  $('empty').style.display = emptyMsg ? '' : 'none'
  const frag = document.createDocumentFragment()
  for (const r of rows) {
    const tr = document.createElement('tr')
    r.forEach((v, i) => {
      const td = document.createElement('td')
      if (NUM_COLS.has(i)) td.className = i === COL.cut70 ? 'num cut' : 'num'
      td.textContent = v == null ? '-' : i === COL.cut70 ? Number(v).toFixed(2) : String(v)
      tr.appendChild(td)
    })
    frag.appendChild(tr)
  }
  $('body').replaceChildren(frag)
}

for (const id of ['g5', 'down', 'up']) $(id).addEventListener('input', render)
$('typeSel').addEventListener('change', (e) => { state.type = e.target.value; render() })
$('trackSel').addEventListener('change', (e) => { state.track = e.target.value; render() })

load().catch((e) => { $('empty').textContent = '데이터를 불러오지 못했습니다: ' + e.message })
</script>
</body>
</html>
```

- [ ] **Step 2: launch.json 작성 후 로컬 서버로 확인**

ES 모듈·fetch는 `file://`로 동작하지 않으므로 정적 서버가 필요하다. `.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "grade5", "runtimeExecutable": "python", "runtimeArgs": ["-m", "http.server", "5180"], "port": 5180 }
  ]
}
```
preview_start `{name: "grade5"}` → `http://localhost:5180/`.

확인 항목(브라우저 도구로):
- 콘솔 오류 없음.
- 5등급제 등급에 `1.1` 입력 → 환산 `1.39`, 안내 "1.29 초과 ~ 1.49 미만 · 범위 내 259건", 표 259행, 첫 행 대학명 `가천대`.
- 아래로 `0.2` → 건수 증가. 등급 `0.5` 입력 → "1.00 ~ 5.00 사이로 입력하세요".
- 지역 칩 `서울` 클릭 → 서울만. 전형 `종합` → 더 줄어듦. 헤더 `70% cut` 클릭 → 오름차순, 재클릭 → 내림차순.
- resize_window mobile → 표 가로 스크롤, 입력 줄바꿈 정상.
- 스크린샷 1장.

- [ ] **Step 3: 커밋**

```bash
git add index.html .claude/launch.json
git commit -m "feat: 5등급제 입결 검색 화면 (입력·환산·범위·필터·정렬 표)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: README + 배포 준비

**Files:**
- Create: `README.md`
- Create: `.nojekyll` (빈 파일)

- [ ] **Step 1: README 작성**

````markdown
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
````

- [ ] **Step 2: .nojekyll 생성 및 커밋**

```bash
touch .nojekyll
git add README.md .nojekyll
git commit -m "docs: README, Pages용 .nojekyll

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 원격 저장소·배포 (사용자 작업 포함)

- [ ] **Step 1: 사용자에게 요청** — gh CLI가 없으므로 사용자가 GitHub 웹에서 공개 저장소 `specialzoker/grade5`를 빈 상태(README 없이)로 만든다. 그 뒤 Settings → Pages → Source = Deploy from a branch, `main` / root.

- [ ] **Step 2: 푸시**

```bash
git remote add origin https://github.com/specialzoker/grade5.git
git push -u origin main
```
Expected: 푸시 성공(git 자격증명관리자 사용). 1~2분 후 `https://specialzoker.github.io/grade5/` 에서 열림.

- [ ] **Step 3: 배포 확인**

브라우저로 `https://specialzoker.github.io/grade5/` 열어 1.1 입력 → 259건 확인.

---

### Task 8: 허브 등록

**Files:**
- Modify: `C:\Users\user\Documents\claude\sujifather\index.html` — `APPS` 배열(약 232~246행)

- [ ] **Step 1: 항목 추가** — `지역산업 연계 대학` 항목 바로 뒤에:

```js
      { name: "5등급제 입결 검색", desc: "5등급제 내신 → 환산 9등급 → 70% cut 근처 모집단위",
        url: "https://specialzoker.github.io/grade5/", category: "대학 찾기·판정", icon: "5️⃣" },
```

- [ ] **Step 2: 로컬 확인** — sujifather를 `python -m http.server 5181`로 열어 카드가 "대학 찾기·판정" 분류에 나타나고 클릭 시 grade5로 이동하는지 확인(로그인 게이트가 있으니 카드 렌더는 게이트 통과 후).

- [ ] **Step 3: 커밋·푸시**

```bash
cd /c/Users/user/Documents/claude/sujifather
git add index.html
git commit -m "feat: 허브에 5등급제 입결 검색 앱 등록

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

---

## 자체 검토

- 스펙 커버리지: 데이터(Task 1), 변환·범위(2), 검색+골든(3), 필터·정렬(4), 화면 5개 요소·0건 메시지 3종·모바일(5), README·배포(6·7), 허브(8). 다크 모드·로그인은 스펙 범위 외.
- 시그니처 일치: `convert(g5, pairs)`, `searchRange(conv, down, up)`→`{lo,hi}`, `search(rows, lo, hi)`, `applyFilters(rows, {regions,type,track})`, `sortRows(rows, colIndex, dir)`, `COL` — 테스트·index.html 모두 동일하게 사용.
