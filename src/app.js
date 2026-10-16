import { COL, convert, searchRange, search, applyFilters, sortRows, matchQuery } from './engine.js'

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

  const q = $('q').value.trim()
  const allRange = $('allRange').checked
  const hint = $('hint')
  hint.className = 'hint'

  // 1) 환산·범위 계산 (전체 검색 모드에서도 환산값은 보여준다)
  let conv = null, range = null
  if (g5 == null) {
    $('convVal').textContent = '–'
    hint.textContent = '등급을 입력하세요.'
  } else if ((conv = convert(g5, state.pairs)) == null) {
    $('convVal').textContent = '–'
    hint.className = 'hint warn'
    hint.textContent = '1.00 ~ 5.00 사이로 입력하세요.'
  } else {
    $('convVal').textContent = conv.toFixed(2)
    range = searchRange(conv, down, up)
  }

  // 2) 전체 입결 검색 모드: 성적 범위 무시
  if (allRange) {
    if (!q) return draw([], '전체 입결에서 찾으려면 검색어를 입력하세요.')
    const rows = applyFilters(matchQuery(state.rows, q), state)
    if (range) hint.innerHTML = `전체 입결 검색 중 · 성적 범위(<b>${range.lo.toFixed(2)} ~ ${range.hi.toFixed(2)}</b>)는 적용하지 않음`
    else if (g5 == null) hint.textContent = '전체 입결 검색 중 · 성적 범위는 적용하지 않음'
    return draw(sortRows(rows, state.sortCol, state.sortDir), rows.length ? '' : '검색 결과가 없습니다.')
  }
  if (!range) return draw([], g5 == null ? '등급을 입력하세요.' : '1.00 ~ 5.00 사이로 입력하세요.')

  // 3) 기본: 성적 범위 안에서 검색어·필터 적용
  const inRange = search(state.rows, range.lo, range.hi)
  const filtered = applyFilters(matchQuery(inRange, q), state)
  hint.innerHTML = `검색 범위 70% cut <b>${range.lo.toFixed(2)} 초과 ~ ${range.hi.toFixed(2)} 미만</b> · 범위 내 <b>${inRange.length}</b>건`
  let empty = ''
  if (inRange.length === 0) empty = '범위 안에 모집단위가 없습니다. 위/아래 폭을 넓혀보세요.'
  else if (filtered.length === 0) empty = q ? '범위 안에 검색 결과가 없습니다.' : '필터 조건에 맞는 결과가 없습니다.'
  draw(sortRows(filtered, state.sortCol, state.sortDir), empty)

  // 범위 밖에는 있는 경우 알려주기
  if (q && filtered.length === 0) {
    const outside = applyFilters(matchQuery(state.rows, q), state).length
    if (outside) {
      $('empty').innerHTML = `범위 안에는 "${escapeHtml(q)}" 결과가 없습니다. 전체 입결에는 <b>${outside}</b>건 있습니다. ` +
        '<button type="button" id="goAll" class="link-btn">전체에서 보기</button>'
      $('goAll').addEventListener('click', () => { $('allRange').checked = true; render() })
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
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
      else if (i === COL.typeName || i === COL.unit) td.className = 'wrap-text'
      td.textContent = v == null ? '-' : i === COL.cut70 ? Number(v).toFixed(2) : String(v)
      tr.appendChild(td)
    })
    frag.appendChild(tr)
  }
  $('body').replaceChildren(frag)
}

for (const id of ['g5', 'down', 'up', 'q']) $(id).addEventListener('input', render)
$('allRange').addEventListener('change', render)
$('typeSel').addEventListener('change', (e) => { state.type = e.target.value; render() })
$('trackSel').addEventListener('change', (e) => { state.track = e.target.value; render() })

load().catch((e) => { $('empty').textContent = '데이터를 불러오지 못했습니다: ' + e.message })
