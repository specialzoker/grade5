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

/** lo < cut70 < hi 인 행만 (양끝 미포함 — 엑셀 결과시트 재현). */
export function search(rows, lo, hi) {
  return rows.filter((r) => {
    const c = r[COL.cut70]
    return typeof c === 'number' && c > lo && c < hi
  })
}

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

const squash = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()

/** 대학명·전형명·모집단위 검색. 검색어를 공백으로 나눈 각 단어가 (세 필드를 이어붙인 문자열에) 모두 들어 있어야 함.
 *  공백·대소문자 무시. 빈 검색어면 rows 그대로. */
export function matchQuery(rows, query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean).map(squash)
  if (!words.length) return rows
  return rows.filter((r) => {
    const hay = squash(r[COL.univ]) + '|' + squash(r[COL.typeName]) + '|' + squash(r[COL.unit])
    return words.every((w) => hay.includes(w))
  })
}
