// 관리자 모달: 학교(코드)·이메일·입장 기록·설정. 허브(sujifather)의 관리자 패턴을 따른다.
import { FieldValue } from './firebase.js'
import { normalizeCode, isEmail, parseExamCodes } from './gate.js'

const ADMIN_PW_DEFAULT = 'xhd1212'
const PW_KEY = 'snavi_pw'   // 허브·통합검색기와 공유(같은 도메인)
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

let toastTimer = null
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show')
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200)
}
const fail = (prefix) => (e) => toast(prefix + ': ' + e.message)

export function initAdmin(db) {
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

  for (const b of document.querySelectorAll('.admin-tabs button')) {
    b.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach((x) => x.classList.toggle('on', x === b))
      document.querySelectorAll('[data-pane]').forEach((p) => { p.style.display = p.dataset.pane === b.dataset.tab ? '' : 'none' })
    })
  }

  // ── 학교 ──
  const schools = db.collection('grade5_schools')
  async function loadSchools() {
    const list = $('schList'); list.innerHTML = '<div class="admin-muted" style="padding:6px">불러오는 중…</div>'
    try {
      const snap = await schools.orderBy('name').get()
      $('schCount').textContent = `${snap.size}교 · 코드는 홈페이지 주소에서 자동 생성(소문자, www·경로 제거)`
      if (snap.empty) { list.innerHTML = '<div class="admin-muted" style="padding:6px">등록된 학교 없음 — "일괄 등록"으로 data/schools.json을 넣으세요.</div>'; return }
      list.innerHTML = snap.docs.map((d) => {
        const s = d.data()
        return `<div class="admin-item" data-id="${d.id}">
          <input value="${esc(s.name)}" data-f="name" />
          <input value="${esc(s.office)}" data-f="office" />
          <input value="${esc(s.homepage)}" data-f="homepage" />
          <span class="code">${esc(s.code) || '(코드 없음)'}</span>
          <input value="${esc((s.examCodes || []).join(', '))}" data-f="exam" placeholder="모의고사 코드" />
          <span><button class="ghost" data-act="save" type="button">저장</button> <button class="danger" data-act="del" type="button">삭제</button></span>
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
        await schools.doc(id).delete(); toast('삭제 완료')
      } else {
        const homepage = get('homepage')
        await schools.doc(id).set({ name: get('name'), office: get('office'), homepage, code: normalizeCode(homepage) || '', examCodes: parseExamCodes(get('exam')) })
        toast('저장 완료')
      }
      loadSchools()
    } catch (err) { fail('실패')(err) }
  })
  $('schAdd').addEventListener('click', async () => {
    const name = $('schName').value.trim(), office = $('schOffice').value.trim(), homepage = $('schHome').value.trim()
    if (!name) { toast('학교명을 입력하세요'); return }
    try {
      await schools.add({ name, office, homepage, code: normalizeCode(homepage) || '', examCodes: parseExamCodes($('schExam').value) })
      $('schName').value = $('schOffice').value = $('schHome').value = $('schExam').value = ''
      toast(`${name} 추가 완료`); loadSchools()
    } catch (err) { fail('추가 실패')(err) }
  })
  $('schBulk').addEventListener('click', async () => {
    try {
      const rows = await fetch('./data/schools.json').then((r) => r.json())
      const existing = new Set((await schools.get()).docs.map((d) => d.data().name))
      const todo = rows.filter((r) => !existing.has(r.name))
      if (!todo.length) { toast('추가할 학교가 없습니다'); return }
      if (!confirm(`${todo.length}교를 등록할까요? (이미 있는 ${existing.size}교는 건너뜀)`)) return
      for (let i = 0; i < todo.length; i += 400) {   // Firestore batch 상한 500
        const batch = db.batch()
        for (const r of todo.slice(i, i + 400)) {
          batch.set(schools.doc(), { name: r.name, office: r.office || '', homepage: r.homepage || '', code: normalizeCode(r.homepage) || '', examCodes: [] })
        }
        await batch.commit()
      }
      toast(`${todo.length}교 등록 완료`); loadSchools()
    } catch (err) { fail('일괄 등록 실패')(err) }
  })

  // ── 이메일 ──
  const emails = db.collection('grade5_emails')
  async function loadEmails() {
    const list = $('emList'); list.innerHTML = '<div class="admin-muted" style="padding:6px">불러오는 중…</div>'
    try {
      const snap = await emails.get()
      if (snap.empty) { list.innerHTML = '<div class="admin-muted" style="padding:6px">등록된 이메일 없음</div>'; return }
      list.innerHTML = snap.docs.map((d) => `<div class="admin-item em" data-id="${esc(d.id)}">
        <span class="code">${esc(d.id)}</span><span>${esc(d.data().name)}</span>
        <button class="danger" data-act="del" type="button">삭제</button></div>`).join('')
    } catch (e) { list.innerHTML = `<div style="color:#f87171;padding:6px">로드 실패: ${esc(e.message)}</div>` }
  }
  $('emAdd').addEventListener('click', async () => {
    const email = $('emAddr').value.trim().toLowerCase(), name = $('emName').value.trim()
    if (!isEmail(email)) { toast('올바른 이메일 형식이 아닙니다'); return }
    try {
      await emails.doc(email).set({ name, addedAt: FieldValue().serverTimestamp() })
      $('emAddr').value = $('emName').value = ''; toast(`${email} 추가 완료`); loadEmails()
    } catch (err) { fail('추가 실패')(err) }
  })
  $('emList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="del"]'); if (!btn) return
    const id = btn.closest('.admin-item').dataset.id
    if (!confirm(`${id} 을 삭제할까요?`)) return
    try { await emails.doc(id).delete(); toast('삭제 완료'); loadEmails() }
    catch (err) { fail('삭제 실패')(err) }
  })

  // ── 입장 기록 ──
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
    } catch (err) { fail('실패')(err) }
  })
}
