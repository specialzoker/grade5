import { COL, convert, searchRange, search, applyFilters, sortRows } from './engine.js'

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
      else if (i === COL.typeName || i === COL.unit) td.className = 'wrap-text'
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
