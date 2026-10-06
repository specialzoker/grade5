// 접근 게이트. 순수 함수(isEmail, isExamCode, parseExamCodes)는 DOM·Firebase를 모른다.
import { FieldValue } from './firebase.js'

export function isEmail(input) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || '').trim())
}

/** 학교 모의고사 코드: 숫자 5자리. */
export function isExamCode(input) {
  return /^\d{5}$/.test(String(input || '').trim())
}

/** "17117, 17872" 같은 입력 → ['17117','17872'] (5자리 숫자만, 중복 제거). */
export function parseExamCodes(input) {
  return [...new Set(String(input || '').split(/[\s,;/]+/).filter((c) => /^\d{5}$/.test(c)))]
}

// ── 아래는 브라우저 전용 (Firestore·localStorage·DOM). node 테스트는 위 순수 함수만 임포트한다.

export const ACCESS_KEY = 'grade5_access'

export function loadAccess() {
  try { const v = JSON.parse(localStorage.getItem(ACCESS_KEY)); return v && v.type ? v : null } catch { return null }
}
export function saveAccess(a) { localStorage.setItem(ACCESS_KEY, JSON.stringify(a)) }
export function clearAccess() { localStorage.removeItem(ACCESS_KEY) }

/** 입력을 판별해 Firestore로 확인. 성공 → {type, who}; 실패 → null. 오류는 throw. */
export async function checkAccess(db, input) {
  if (isExamCode(input)) {
    const snap = await db.collection('grade5_schools').where('examCodes', 'array-contains', input.trim()).limit(1).get()
    if (snap.empty) return null
    return { type: 'school', who: snap.docs[0].data().name }
  }
  if (isEmail(input)) {
    const email = input.trim().toLowerCase()
    const doc = await db.collection('grade5_emails').doc(email).get()
    return doc.exists ? { type: 'email', who: email } : null
  }
  return null   // 홈페이지 주소 입장은 2026-10-06 폐지
}

/** grade5_meta/gate.version. 조회 실패 시 null → 기억을 그대로 신뢰. */
export async function currentVersion(db) {
  try { const d = await db.collection('grade5_meta').doc('gate').get(); return d.exists ? (d.data().version || 1) : 1 }
  catch { return null }
}

async function logEntry(db, a) {
  try {
    await db.collection('grade5_logs').add({ type: a.type, who: a.who, at: FieldValue().serverTimestamp(), ua: navigator.userAgent.slice(0, 80) })
  } catch { /* 기록 실패는 무시 */ }
}

/** 오버레이 표시·검증·기억. index.html의 #gate 마크업을 사용. */
export function initGate(db) {
  const $ = (id) => document.getElementById(id)
  const overlay = $('gate'), input = $('gateInput'), btn = $('gateBtn'), msg = $('gateMsg')
  const who = $('gateWho'), leave = $('gateLeave'), whoLine = who.parentElement

  function open(a) {
    overlay.style.display = 'none'
    msg.textContent = ''
    who.textContent = a.who
    whoLine.style.display = ''
  }
  function close() {
    overlay.style.display = ''
    whoLine.style.display = 'none'
    msg.textContent = ''
    input.value = ''
    input.focus()
  }

  async function submit() {
    const v = input.value
    if (!v.trim()) { msg.textContent = '모의고사 코드 또는 이메일을 입력하세요.'; return }
    if (!isExamCode(v) && !isEmail(v)) { msg.textContent = '모의고사 코드는 숫자 5자리, 이메일은 전체 주소를 입력하세요.'; return }
    btn.disabled = true; msg.textContent = '확인 중…'
    try {
      const a = await checkAccess(db, v)
      if (!a) { msg.textContent = '등록되지 않은 모의고사 코드/이메일입니다.'; return }
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
    open(saved)                          // 일단 열고
    currentVersion(db).then((ver) => {   // 관리자가 기억을 초기화했으면 다시 요구
      if (ver != null && saved.v !== ver) { clearAccess(); close() }
    })
  } else {
    close()
  }
}
