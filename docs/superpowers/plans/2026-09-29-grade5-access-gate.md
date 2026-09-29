# 학교 코드 접근 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** grade5 앱을 학교 코드(홈페이지 도메인) 또는 등록 이메일로만 열리게 하고, 브라우저에 기억시키며, 관리자 모달에서 학교·이메일·기록을 관리한다.

**Architecture:** 기존 인라인 앱 스크립트를 `src/app.js`로 옮기고, `src/gate.js`(순수 함수 + Firestore 조회 + localStorage), `src/admin.js`(관리자 모달), `src/firebase.js`(compat SDK 초기화)를 추가한다. Firestore는 허브와 같은 프로젝트 `search-alluniv`의 새 컬렉션 4개(`grade5_schools`, `grade5_emails`, `grade5_logs`, `grade5_meta`)를 쓴다.

**Tech Stack:** HTML/CSS/vanilla JS(ES modules), Firebase compat SDK 10.12.0(`<script>` 로드, `window.firebase`), Node 24 `node:test`.

**스펙:** `docs/superpowers/specs/2026-09-29-grade5-access-gate-design.md`

**환경 주의**
- 작업 폴더 `/c/Users/user/Documents/claude/grade5`. node PATH: `export PATH="/c/Users/user/AppData/Local/OpenAI/Codex/runtimes/cua_node/ecfc0d9aa02807e3/bin:$PATH"` (해시 폴더는 `ls -d .../cua_node/*/bin`으로 확인).
- 로컬 미리보기: preview_start `{name:"grade5"}` (navi의 `.claude/launch.json`에 `--directory` 항목 있음) → http://localhost:5180/. Firestore는 로컬에서도 실제 프로젝트에 붙는다.
- 홈페이지 조사 결과는 scratchpad `schools_part1..4.json`(백그라운드 에이전트 산출물).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `index.html` | 마크업·스타일. 인라인 스크립트 제거, `src/app.js` 임포트. 게이트 오버레이 + 관리자 모달 마크업 추가 |
| `src/app.js` | 기존 인라인 앱 로직 그대로(검색·필터·표) |
| `src/gate.js` | `normalizeCode`, `isEmail`, `checkAccess(db, input)`, `loadAccess/saveAccess/clearAccess`, `initGate()` |
| `src/admin.js` | 관리자 모달(학교/이메일/기록 탭, 일괄 등록, 기억 초기화, 비밀번호) |
| `src/firebase.js` | `firebaseConfig`, `getDb()` |
| `data/schools.json` | 102교 `{name, office, homepage}` |
| `test/gate.test.js` | 순수 함수 테스트 |

---

### Task 1: 인라인 스크립트를 src/app.js로 분리 (동작 변화 없음)

**Files:**
- Modify: `index.html` (`<script type="module">…</script>` 블록)
- Create: `src/app.js`

- [ ] **Step 1: src/app.js 생성** — `index.html`의 `<script type="module">` 안 내용을 그대로 옮기되, 첫 줄 import 경로만 바꾼다.

```js
import { COL, convert, searchRange, search, applyFilters, sortRows } from './engine.js'
// (이하 index.html 인라인 스크립트 내용 그대로: HEADERS, NUM_COLS, $, state, 헤더 생성, load, num, render, draw, 이벤트 바인딩, load().catch(...))
```

- [ ] **Step 2: index.html의 인라인 스크립트를 한 줄로 교체**

```html
<script type="module" src="./src/app.js"></script>
```

- [ ] **Step 3: 브라우저 확인** — preview_start grade5, `1.1` 입력 → 환산 1.39·259건. 콘솔 오류 없음.

- [ ] **Step 4: 커밋**

```bash
git add index.html src/app.js
git commit -m "refactor: 앱 스크립트를 src/app.js로 분리

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: gate.js 순수 함수 (TDD)

**Files:**
- Create: `src/gate.js`
- Create: `test/gate.test.js`

- [ ] **Step 1: 실패 테스트**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCode, isEmail } from '../src/gate.js'

test('normalizeCode: 스킴·경로·www·대소문자·공백 제거', () => {
  assert.equal(normalizeCode('https://www.Gaun.hs.kr/main.do'), 'gaun.hs.kr')
  assert.equal(normalizeCode('  gaun.hs.kr  '), 'gaun.hs.kr')
  assert.equal(normalizeCode('http://gaun.hs.kr/'), 'gaun.hs.kr')
  assert.equal(normalizeCode('www.gaun.hs.kr'), 'gaun.hs.kr')
  assert.equal(normalizeCode('https://school.goe.go.kr/gaun?x=1'), 'school.goe.go.kr')
})

test('normalizeCode: 빈 값은 null', () => {
  assert.equal(normalizeCode(''), null)
  assert.equal(normalizeCode('   '), null)
  assert.equal(normalizeCode('https://'), null)
  assert.equal(normalizeCode(null), null)
})

test('isEmail', () => {
  assert.equal(isEmail('a@b.co'), true)
  assert.equal(isEmail(' A@B.co '), true)
  assert.equal(isEmail('gaun.hs.kr'), false)
  assert.equal(isEmail('a@b'), false)
})
```

- [ ] **Step 2: 실패 확인** — `node --test test/gate.test.js` → `Cannot find module '.../src/gate.js'`

- [ ] **Step 3: 구현 (순수 함수 부분만)**

```js
// 접근 게이트. 순수 함수(normalizeCode, isEmail)는 DOM·Firebase를 모른다.

/** 홈페이지 주소 → 코드. 소문자, 스킴·경로·앞 www. 제거. 빈 값이면 null. */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.split(/[/?#]/)[0]
  s = s.replace(/^www\./, '')
  return s || null
}

export function isEmail(input) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || '').trim())
}
```

- [ ] **Step 4: 통과 확인** — `node --test test/gate.test.js test/engine.test.js` → pass 14, fail 0

- [ ] **Step 5: 커밋**

```bash
git add src/gate.js test/gate.test.js
git commit -m "feat: 게이트 코드 정규화·이메일 판별 함수

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Firebase 초기화 + 게이트 오버레이

**Files:**
- Create: `src/firebase.js`
- Modify: `src/gate.js` (Firestore 조회·localStorage·UI 추가)
- Modify: `index.html` (SDK script 2줄, 오버레이 마크업·스타일, app.js 앞에 gate 초기화)

- [ ] **Step 1: src/firebase.js**

```js
// 허브(sujifather)·통합검색기와 같은 Firebase 프로젝트. compat SDK는 index.html <script>로 로드됨.
const firebaseConfig = {
  apiKey: "AIzaSyAF0-GXeRRrtUsdQgS3L-CjkAL4eUrM3cc",
  authDomain: "search-alluniv.firebaseapp.com",
  projectId: "search-alluniv",
  storageBucket: "search-alluniv.firebasestorage.app",
  messagingSenderId: "395338642740",
  appId: "1:395338642740:web:c902a7e5f39e61adce2161",
}

let db = null
export function getDb() {
  if (!db) {
    if (!window.firebase) throw new Error('Firebase SDK가 로드되지 않았습니다')
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    db = firebase.firestore()
  }
  return db
}
export const FieldValue = () => firebase.firestore.FieldValue
```

- [ ] **Step 2: gate.js에 저장·조회·UI 추가** (Task 2의 순수 함수 아래에)

```js
import { getDb, FieldValue } from './firebase.js'

export const ACCESS_KEY = 'grade5_access'

export function loadAccess() {
  try { const v = JSON.parse(localStorage.getItem(ACCESS_KEY)); return v && v.type ? v : null } catch { return null }
}
export function saveAccess(a) { localStorage.setItem(ACCESS_KEY, JSON.stringify(a)) }
export function clearAccess() { localStorage.removeItem(ACCESS_KEY) }

/** 입력을 판별해 Firestore로 확인. 성공 → {type, who}; 실패 → null. 오류는 throw. */
export async function checkAccess(db, input) {
  if (isEmail(input)) {
    const email = input.trim().toLowerCase()
    const doc = await db.collection('grade5_emails').doc(email).get()
    return doc.exists ? { type: 'email', who: email } : null
  }
  const code = normalizeCode(input)
  if (!code) return null
  const snap = await db.collection('grade5_schools').where('code', '==', code).limit(1).get()
  if (snap.empty) return null
  return { type: 'school', who: snap.docs[0].data().name }
}

export async function currentVersion(db) {
  try { const d = await db.collection('grade5_meta').doc('gate').get(); return d.exists ? (d.data().version || 1) : 1 }
  catch { return null }   // 조회 실패 시 null → 기억을 그대로 신뢰
}

async function logEntry(db, a) {
  try {
    await db.collection('grade5_logs').add({ type: a.type, who: a.who, at: FieldValue().serverTimestamp(), ua: navigator.userAgent.slice(0, 80) })
  } catch { /* 기록 실패는 무시 */ }
}

/** 오버레이 표시·검증·기억. index.html의 #gate 마크업을 사용. */
export function initGate() {
  const $ = (id) => document.getElementById(id)
  const overlay = $('gate'), input = $('gateInput'), btn = $('gateBtn'), msg = $('gateMsg')
  const who = $('gateWho'), leave = $('gateLeave')
  const db = getDb()

  function open(a) {
    overlay.style.display = 'none'
    who.textContent = a.who
    who.parentElement.style.display = ''
  }
  function close() {
    overlay.style.display = ''
    who.parentElement.style.display = 'none'
    msg.textContent = ''
    input.value = ''
    input.focus()
  }

  async function submit() {
    const v = input.value
    if (!v.trim()) { msg.textContent = '코드 또는 이메일을 입력하세요.'; return }
    btn.disabled = true; msg.textContent = '확인 중…'
    try {
      const a = await checkAccess(db, v)
      if (!a) { msg.textContent = '등록되지 않은 코드/이메일입니다. 학교 홈페이지 주소를 확인하세요.'; return }
      const ver = await currentVersion(db)
      saveAccess({ ...a, at: Date.now(), v: ver ?? 1 })
      logEntry(db, a)
      open(a)
    } catch (e) {
      msg.textContent = '확인 중 오류가 났습니다. 잠시 후 다시 시도하세요. (' + e.message + ')'
    } finally { btn.disabled = false }
  }

  btn.addEventListener('click', submit)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit() })
  leave.addEventListener('click', () => { clearAccess(); close() })

  const saved = loadAccess()
  if (saved) {
    open(saved)                       // 일단 열고
    currentVersion(db).then((ver) => {  // 버전이 바뀌었으면 다시 요구
      if (ver != null && saved.v !== ver) { clearAccess(); close() }
    })
  } else {
    close()
  }
}
```

- [ ] **Step 3: index.html 마크업·스타일·스크립트**

`<head>` 끝(`</style>` 다음)에 SDK:
```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
```

`<style>`에 추가:
```css
  #gate { position:fixed; inset:0; background:var(--cream); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
  .gate-card { width:100%; max-width:440px; background:var(--card); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); padding:24px 22px; text-align:center; }
  .gate-card img { width:90px; display:block; margin:0 auto 8px; }
  .gate-card h2 { margin:0 0 4px; color:var(--green); font-size:20px; }
  .gate-card p { margin:0 0 14px; color:var(--muted); font-size:13px; }
  .gate-card input { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:6px; font-size:15px; margin-bottom:8px; }
  .gate-card button { width:100%; padding:10px; background:var(--green); color:#fff; border:none; border-radius:6px; font-size:15px; cursor:pointer; }
  .gate-card button:disabled { opacity:.6; }
  .gate-msg { min-height:20px; margin-top:8px; font-size:13px; color:#a3462a; }
  .who { font-size:12px; color:var(--muted); margin-top:6px; }
  .who b { color:var(--green); }
  .who button { background:none; border:none; color:var(--muted); text-decoration:underline; cursor:pointer; font-size:12px; margin-left:6px; }
```

`<div class="wrap">` 바로 앞에 오버레이:
```html
<div id="gate">
  <div class="gate-card">
    <img src="./assets/gyeonggi-jinhyup-logo.png" alt="" />
    <h2>5등급제 입결 검색</h2>
    <p>학교 홈페이지 주소(코드) 또는 등록된 이메일을 입력하세요.</p>
    <input id="gateInput" placeholder="예: www.gaun.hs.kr" autocomplete="off" />
    <button id="gateBtn" type="button">입장</button>
    <div id="gateMsg" class="gate-msg"></div>
  </div>
</div>
```

`.badge` 안 `.notice` 아래에 현재 학교 표시:
```html
    <p class="who" style="display:none"><b id="gateWho"></b> · <button id="gateLeave" type="button">나가기</button></p>
```

`<script type="module" src="./src/app.js">` 앞에:
```html
<script type="module">
  import { initGate } from './src/gate.js'
  initGate()
</script>
```

- [ ] **Step 4: 브라우저 확인(규칙 반영 전이라 조회는 permission-denied 예상)** — 오버레이가 뜨고, 아무 값 입력 시 "확인 중 오류…(Missing or insufficient permissions)" 메시지. 콘솔에 다른 오류 없음. (Task 6에서 규칙 추가 후 실제 통과 확인)

- [ ] **Step 5: 커밋**

```bash
git add src/firebase.js src/gate.js index.html
git commit -m "feat: 학교 코드·이메일 입장 게이트 (Firestore 조회, 브라우저 기억)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 관리자 모달

**Files:**
- Create: `src/admin.js`
- Modify: `index.html` (⚙ 버튼, 모달 마크업·스타일, 초기화 스크립트)

- [ ] **Step 1: 마크업** — `.badge` 위쪽(`<div class="top">` 안, 오른쪽 끝)에 버튼, `</body>` 앞에 모달·토스트:

```html
<button id="adminBtn" class="admin-btn" type="button" title="관리자">⚙</button>
```
```html
<div id="adminPanel">
  <div class="admin-card">
    <div class="admin-head"><h3>관리자</h3><button id="adminClose" type="button">✕</button></div>
    <div id="adminLock">
      <input id="adminPw" type="password" placeholder="관리자 비밀번호" />
      <button id="adminPwBtn" type="button">확인</button>
    </div>
    <div id="adminContent" style="display:none">
      <div class="admin-tabs">
        <button data-tab="schools" class="on" type="button">학교</button>
        <button data-tab="emails" type="button">이메일</button>
        <button data-tab="logs" type="button">입장 기록</button>
        <button data-tab="etc" type="button">설정</button>
      </div>
      <section data-pane="schools">
        <div class="admin-row">
          <input id="schName" placeholder="학교명" /><input id="schOffice" placeholder="지원청" /><input id="schHome" placeholder="홈페이지 주소" />
          <button id="schAdd" type="button">추가</button>
          <button id="schBulk" type="button" title="data/schools.json에서 없는 학교만 넣기">일괄 등록</button>
        </div>
        <div id="schCount" class="admin-muted"></div>
        <div id="schList" class="admin-list"></div>
      </section>
      <section data-pane="emails" style="display:none">
        <div class="admin-row">
          <input id="emAddr" placeholder="이메일" /><input id="emName" placeholder="이름(선택)" />
          <button id="emAdd" type="button">추가</button>
        </div>
        <div id="emList" class="admin-list"></div>
      </section>
      <section data-pane="logs" style="display:none">
        <div id="logList" class="admin-list"></div>
      </section>
      <section data-pane="etc" style="display:none">
        <div class="admin-row"><input id="pw1" type="password" placeholder="새 비밀번호" /><input id="pw2" type="password" placeholder="확인" /><button id="pwChange" type="button">비밀번호 변경</button></div>
        <p class="admin-muted">비밀번호는 허브(sujifather)·통합검색기와 같은 저장키를 씁니다.</p>
        <div class="admin-row"><button id="resetAll" type="button" class="danger">모든 기억 초기화</button><span class="admin-muted">모든 브라우저가 다음 접속 때 코드를 다시 입력해야 합니다.</span></div>
      </section>
    </div>
  </div>
</div>
<div id="toast"></div>
```

스타일:
```css
  .admin-btn { position:fixed; right:12px; bottom:12px; width:36px; height:36px; border-radius:50%; border:1px solid var(--line); background:var(--card); color:var(--muted); cursor:pointer; font-size:16px; z-index:900; }
  #adminPanel { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:2000; display:none; align-items:flex-start; justify-content:center; padding:24px 12px; overflow-y:auto; }
  #adminPanel.open { display:flex; }
  .admin-card { width:100%; max-width:860px; background:#1a1a1a; color:#eee; border:1px solid #333; border-radius:12px; padding:18px; }
  .admin-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .admin-head h3 { margin:0; font-size:15px; }
  .admin-head button { background:none; border:none; color:#aaa; font-size:16px; cursor:pointer; }
  .admin-card input { background:#111; color:#eee; border:1px solid #333; border-radius:5px; padding:6px 8px; font-size:13px; }
  .admin-card button { background:#2f6b45; color:#fff; border:none; border-radius:5px; padding:6px 10px; font-size:12px; cursor:pointer; }
  .admin-card button.danger { background:#7f1d1d; }
  .admin-card button.ghost { background:#333; }
  .admin-tabs { display:flex; gap:6px; margin:8px 0 12px; }
  .admin-tabs button { background:#333; }
  .admin-tabs button.on { background:#2f6b45; }
  .admin-row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:8px; }
  .admin-row input { flex:1 1 140px; }
  .admin-muted { color:#888; font-size:11px; margin:4px 0 8px; }
  .admin-list { max-height:60vh; overflow:auto; border:1px solid #2a2a2a; border-radius:6px; }
  .admin-item { display:grid; grid-template-columns:1.2fr .8fr 1.6fr 1.2fr auto; gap:6px; align-items:center; padding:5px 8px; border-bottom:1px solid #2a2a2a; font-size:12px; }
  .admin-item.em { grid-template-columns:2fr 1fr auto; }
  .admin-item.log { grid-template-columns:1.3fr .6fr 2fr; }
  .admin-item input { width:100%; }
  .admin-item .code { font-family:monospace; color:#9ad; }
  #toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:#222; color:#fff; padding:8px 14px; border-radius:6px; font-size:13px; opacity:0; transition:opacity .2s; z-index:3000; pointer-events:none; }
  #toast.show { opacity:1; }
```

- [ ] **Step 2: src/admin.js**

```js
import { getDb, FieldValue } from './firebase.js'
import { normalizeCode, isEmail } from './gate.js'

const ADMIN_PW_DEFAULT = 'xhd1212'
const PW_KEY = 'snavi_pw'   // 허브·통합검색기와 공유
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

let toastTimer = null
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show')
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200)
}

export function initAdmin() {
  const db = getDb()
  const panel = $('adminPanel')

  $('adminBtn').addEventListener('click', () => {
    panel.classList.add('open'); $('adminLock').style.display = ''; $('adminContent').style.display = 'none'
    $('adminPw').value = ''; $('adminPw').focus()
  })
  $('adminClose').addEventListener('click', () => panel.classList.remove('open'))
  panel.addEventListener('click', (e) => { if (e.target === panel) panel.classList.remove('open') })

  function unlock() {
    const saved = localStorage.getItem(PW_KEY) || ADMIN_PW_DEFAULT
    if ($('adminPw').value !== saved) { toast('비밀번호가 틀렸습니다'); $('adminPw').value = ''; return }
    $('adminLock').style.display = 'none'; $('adminContent').style.display = ''
    loadSchools(); loadEmails(); loadLogs()
  }
  $('adminPwBtn').addEventListener('click', unlock)
  $('adminPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

  // 탭
  for (const b of document.querySelectorAll('.admin-tabs button')) {
    b.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach((x) => x.classList.toggle('on', x === b))
      document.querySelectorAll('[data-pane]').forEach((p) => { p.style.display = p.dataset.pane === b.dataset.tab ? '' : 'none' })
    })
  }

  // ── 학교 ──
  async function loadSchools() {
    const list = $('schList'); list.innerHTML = '<div class="admin-muted" style="padding:6px">불러오는 중…</div>'
    try {
      const snap = await db.collection('grade5_schools').orderBy('name').get()
      $('schCount').textContent = `${snap.size}교`
      if (snap.empty) { list.innerHTML = '<div class="admin-muted" style="padding:6px">등록된 학교 없음 — "일괄 등록"으로 data/schools.json을 넣으세요.</div>'; return }
      list.innerHTML = snap.docs.map((d) => {
        const s = d.data()
        return `<div class="admin-item" data-id="${d.id}">
          <input value="${esc(s.name)}" data-f="name" />
          <input value="${esc(s.office)}" data-f="office" />
          <input value="${esc(s.homepage)}" data-f="homepage" />
          <span class="code">${esc(s.code) || '(코드 없음)'}</span>
          <span><button class="ghost" data-act="save">저장</button> <button class="danger" data-act="del">삭제</button></span>
        </div>`
      }).join('')
    } catch (e) { list.innerHTML = `<div style="color:#f87171;padding:6px">로드 실패: ${esc(e.message)}</div>` }
  }
  $('schList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return
    const row = btn.closest('.admin-item'); const id = row.dataset.id
    const get = (f) => row.querySelector(`[data-f="${f}"]`).value.trim()
    try {
      if (btn.dataset.act === 'del') {
        if (!confirm(`${get('name')} 을(를) 삭제할까요?`)) return
        await db.collection('grade5_schools').doc(id).delete(); toast('삭제 완료')
      } else {
        const homepage = get('homepage'), code = normalizeCode(homepage) || ''
        await db.collection('grade5_schools').doc(id).set({ name: get('name'), office: get('office'), homepage, code })
        toast('저장 완료')
      }
      loadSchools()
    } catch (err) { toast('실패: ' + err.message) }
  })
  $('schAdd').addEventListener('click', async () => {
    const name = $('schName').value.trim(), office = $('schOffice').value.trim(), homepage = $('schHome').value.trim()
    if (!name) { toast('학교명을 입력하세요'); return }
    try {
      await db.collection('grade5_schools').add({ name, office, homepage, code: normalizeCode(homepage) || '' })
      $('schName').value = $('schOffice').value = $('schHome').value = ''
      toast(`${name} 추가 완료`); loadSchools()
    } catch (err) { toast('추가 실패: ' + err.message) }
  })
  $('schBulk').addEventListener('click', async () => {
    try {
      const rows = await fetch('./data/schools.json').then((r) => r.json())
      const existing = new Set((await db.collection('grade5_schools').get()).docs.map((d) => d.data().name))
      const todo = rows.filter((r) => !existing.has(r.name))
      if (!todo.length) { toast('추가할 학교가 없습니다'); return }
      if (!confirm(`${todo.length}교를 등록할까요? (이미 있는 ${existing.size}교는 건너뜀)`)) return
      for (let i = 0; i < todo.length; i += 400) {   // Firestore batch 상한 500
        const batch = db.batch()
        for (const r of todo.slice(i, i + 400)) {
          batch.set(db.collection('grade5_schools').doc(), { name: r.name, office: r.office || '', homepage: r.homepage || '', code: normalizeCode(r.homepage) || '' })
        }
        await batch.commit()
      }
      toast(`${todo.length}교 등록 완료`); loadSchools()
    } catch (err) { toast('일괄 등록 실패: ' + err.message) }
  })

  // ── 이메일 ──
  async function loadEmails() {
    const list = $('emList'); list.innerHTML = '<div class="admin-muted" style="padding:6px">불러오는 중…</div>'
    try {
      const snap = await db.collection('grade5_emails').get()
      if (snap.empty) { list.innerHTML = '<div class="admin-muted" style="padding:6px">등록된 이메일 없음</div>'; return }
      list.innerHTML = snap.docs.map((d) => `<div class="admin-item em" data-id="${esc(d.id)}">
        <span class="code">${esc(d.id)}</span><span>${esc(d.data().name)}</span>
        <button class="danger" data-act="del">삭제</button></div>`).join('')
    } catch (e) { list.innerHTML = `<div style="color:#f87171;padding:6px">로드 실패: ${esc(e.message)}</div>` }
  }
  $('emAdd').addEventListener('click', async () => {
    const email = $('emAddr').value.trim().toLowerCase(), name = $('emName').value.trim()
    if (!isEmail(email)) { toast('올바른 이메일 형식이 아닙니다'); return }
    try {
      await db.collection('grade5_emails').doc(email).set({ name, addedAt: FieldValue().serverTimestamp() })
      $('emAddr').value = $('emName').value = ''; toast(`${email} 추가 완료`); loadEmails()
    } catch (err) { toast('추가 실패: ' + err.message) }
  })
  $('emList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="del"]'); if (!btn) return
    const id = btn.closest('.admin-item').dataset.id
    if (!confirm(`${id} 을 삭제할까요?`)) return
    try { await db.collection('grade5_emails').doc(id).delete(); toast('삭제 완료'); loadEmails() }
    catch (err) { toast('삭제 실패: ' + err.message) }
  })

  // ── 기록 ──
  async function loadLogs() {
    const list = $('logList'); list.innerHTML = '<div class="admin-muted" style="padding:6px">불러오는 중…</div>'
    try {
      const snap = await db.collection('grade5_logs').orderBy('at', 'desc').limit(200).get()
      if (snap.empty) { list.innerHTML = '<div class="admin-muted" style="padding:6px">기록 없음</div>'; return }
      list.innerHTML = snap.docs.map((d) => {
        const l = d.data(); const t = l.at && l.at.toDate ? l.at.toDate().toLocaleString('ko-KR') : ''
        return `<div class="admin-item log"><span>${esc(t)}</span><span>${l.type === 'email' ? '이메일' : '학교'}</span><span>${esc(l.who)}</span></div>`
      }).join('')
    } catch (e) { list.innerHTML = `<div style="color:#f87171;padding:6px">로드 실패: ${esc(e.message)}</div>` }
  }

  // ── 설정 ──
  $('pwChange').addEventListener('click', () => {
    const p1 = $('pw1').value, p2 = $('pw2').value
    if (!p1) { toast('새 비밀번호를 입력하세요'); return }
    if (p1 !== p2) { toast('비밀번호가 일치하지 않습니다'); return }
    localStorage.setItem(PW_KEY, p1); $('pw1').value = $('pw2').value = ''; toast('비밀번호 변경 완료')
  })
  $('resetAll').addEventListener('click', async () => {
    if (!confirm('모든 브라우저의 입장 기억을 초기화할까요? (다음 접속 때 코드를 다시 입력해야 합니다)')) return
    try {
      const ref = db.collection('grade5_meta').doc('gate')
      const cur = await ref.get(); const v = (cur.exists ? cur.data().version || 1 : 1) + 1
      await ref.set({ version: v }); toast(`초기화 완료 (버전 ${v})`)
    } catch (err) { toast('실패: ' + err.message) }
  })
}
```

- [ ] **Step 3: 초기화 스크립트** — Task 3의 게이트 초기화 모듈에 admin도 추가:

```html
<script type="module">
  import { initGate } from './src/gate.js'
  import { initAdmin } from './src/admin.js'
  initGate()
  initAdmin()
</script>
```

- [ ] **Step 4: 브라우저 확인** — ⚙ → 비밀번호 `xhd1212` → 모달 열림, 탭 전환. (Firestore 규칙 전이면 목록에 "로드 실패: Missing or insufficient permissions" — 정상)

- [ ] **Step 5: 커밋**

```bash
git add src/admin.js index.html
git commit -m "feat: 관리자 모달 (학교·이메일·입장 기록·기억 초기화)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 학교 홈페이지 목록 data/schools.json

**Files:**
- Create: `data/schools.json`
- Create: `scripts/merge_schools.py`

- [ ] **Step 1: 병합 스크립트**

```python
"""scratchpad의 schools_part1..4.json(에이전트 조사 결과)을 data/schools.json으로 병합. 원본 102교 순서·이름과 대조."""
import json, os, sys
SCRATCH = r"C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Documents-claude-navi\643ea7b9-3c7b-4214-ae8a-de344f7ef1f9\scratchpad"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = json.load(open(os.path.join(SCRATCH, "schools_base.json"), encoding="utf-8"))
found = {}
for i in range(1, 5):
    p = os.path.join(SCRATCH, f"schools_part{i}.json")
    if not os.path.exists(p): print("missing", p); continue
    for r in json.load(open(p, encoding="utf-8")):
        found[r["name"]] = r
out, missing, low = [], [], []
for b in base:
    r = found.get(b["name"], {})
    hp = (r.get("homepage") or "").strip()
    out.append({"name": b["name"], "office": b["office"], "homepage": hp})
    if not hp: missing.append(b["name"])
    elif r.get("confidence") == "low": low.append((b["name"], hp))
json.dump(out, open(os.path.join(ROOT, "data", "schools.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"total {len(out)}, with homepage {len(out)-len(missing)}, missing {missing}, low {low}")
```

- [ ] **Step 2: 실행** — `PYTHONIOENCODING=utf-8 python scripts/merge_schools.py` → `total 102, with homepage N, missing [...]`

- [ ] **Step 3: 사용자 검토용 표** — 102행(학교명·지원청·홈페이지)을 채팅에 마크다운 표로 보여주고, 못 찾은 학교·low 신뢰 학교를 따로 표시.

- [ ] **Step 4: 커밋**

```bash
git add data/schools.json scripts/merge_schools.py
git commit -m "data: 102교 홈페이지 주소 목록

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Firestore 규칙 + 초기 적재 + 실제 동작 검증

- [ ] **Step 1: Firebase 콘솔 규칙 추가 (크롬 확장)** — https://console.firebase.google.com/project/search-alluniv/firestore/rules 에서 기존 규칙 안 `match /databases/{database}/documents {` 블록에 추가 후 "게시":

```
    match /grade5_schools/{doc} { allow read, write: if true; }
    match /grade5_emails/{doc}  { allow read, write: if true; }
    match /grade5_logs/{doc}    { allow read, create: if true; }
    match /grade5_meta/{doc}    { allow read, write: if true; }
```
기존 규칙은 건드리지 않는다. 기존 규칙 전체 텍스트를 먼저 읽어 형태를 맞춘다.

- [ ] **Step 2: 로컬에서 초기 적재** — preview grade5 → ⚙ → 학교 탭 → "일괄 등록" → 102교 확인.

- [ ] **Step 3: 입장 검증(로컬)**
  - 오버레이에 `www.gaun.hs.kr`(또는 목록의 아무 코드) → 통과, 배지 아래 "가운고등학교 · 나가기".
  - 새로고침 → 오버레이 없이 바로 열림.
  - "나가기" → 오버레이 복귀. 잘못된 코드 `nope.hs.kr` → 실패 메시지.
  - 관리자 이메일 탭에 `specialzoker@gmail.com` 추가 → 오버레이에 그 이메일 → 통과.
  - 관리자 "모든 기억 초기화" → 새로고침 → 오버레이 다시 뜸.
  - 입장 기록 탭에 위 시도들이 보임.

- [ ] **Step 4: README 갱신** — "접근 게이트" 절 추가(코드 규칙, 관리자, Firestore 컬렉션 4개, 규칙).

- [ ] **Step 5: 커밋·푸시·배포 확인**

```bash
git add README.md
git commit -m "docs: 접근 게이트 설명

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```
배포 후 https://specialzoker.github.io/grade5/ 에서 코드 입장 1회 확인.

---

## 자체 검토

- 스펙 커버리지: 데이터 4컬렉션(3·4·6), 정규화(2), 게이트 화면·기억·나가기·오류 메시지(3), 버전 기억 무효화(3·4), 관리자 4탭·일괄 등록·비밀번호(4), 홈페이지 조사·검토 표(5), 규칙·검증·배포(6).
- 시그니처: `normalizeCode`, `isEmail`, `checkAccess(db,input)`, `loadAccess/saveAccess/clearAccess`, `currentVersion(db)`, `initGate()`, `initAdmin()`, `getDb()`, `FieldValue()` — 파일 간 동일.
- DOM id: gate/gateInput/gateBtn/gateMsg/gateWho/gateLeave, adminBtn/adminPanel/adminClose/adminLock/adminPw/adminPwBtn/adminContent, schName/schOffice/schHome/schAdd/schBulk/schCount/schList, emAddr/emName/emAdd/emList, logList, pw1/pw2/pwChange/resetAll, toast — 마크업과 JS 일치.
